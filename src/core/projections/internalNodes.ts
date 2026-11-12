import type {
  CoordinateExtent,
  Handle,
  NodeHandleBounds,
  NodeOrigin,
  ZIndexMode,
} from "@xyflow/system";
import {
  type Accessor,
  createMemo,
  createProjection,
  getOwner,
  mapArray,
  onCleanup,
  runWithOwner,
  untrack,
} from "solid-js";

import type { InternalNode, Node } from "@/types";

import { nodePinned } from "../culling";
import { dragEntry, type DragOverlay, joinDragging, joinPosition } from "../dragOverlay";
import { emitFlowError } from "../rules";
import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import {
  buildRow,
  coldRootRect,
  computeRowState,
  edgeZOf,
  type RowSettings,
  type RowState,
  writeChangedLeaves,
} from "./internalNodeRow";
import { createEntryHolders, createRecordFacade, RowEntry } from "./rowRecord";

/** Row keys the derive joins itself: read from the row proxy, never from the snapshot. */
const JOINED_KEYS: ReadonlySet<string> = new Set(["selected", "dragging"]);

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, i) => key === b[i]);

/**
 * The user row's key set minus the joined keys, tracked as its own memo:
 * the engine notifies the key set on any key add or delete, and a first
 * `selected = true` ADDS a key — this memo absorbs that (equal value), so
 * the copy below never re-runs for a joined key (bench round 41).
 */
const createUserKeys = (node: () => object): Accessor<readonly string[]> =>
  createMemo(
    () => {
      const keys: string[] = [];
      for (const key of Object.keys(node())) if (!JOINED_KEYS.has(key)) keys.push(key);
      return keys;
    },
    { equals: sameKeys, name: "internalNodes.userKeys" },
  );

/**
 * One enumeration of the user row per user change, WITHOUT reading the keys
 * the derive joins itself (`selected`, `dragging`): a write to either wakes
 * only the derive's own leaf read, so a select-all over 10k rows is 10k
 * leaf writes, not 10k spreads and reconciles (bench round 41). The copy is
 * a plain object: the derive reads it freely without proxy traps.
 */
const snapshotUserRow = <NodeType extends Node>(
  node: NodeType,
  keys: readonly string[],
): NodeType => {
  const copy: Partial<NodeType> = {};
  for (const key of keys) Reflect.set(copy, key, Reflect.get(node, key));
  // The one cast: a key-filtered copy has no expressible type; the row
  // literal supplies the two joined keys itself.
  return copy as NodeType;
};

/** One node's DOM-derived state, written by the measurement ingest. */
export type NodeMeasurement = {
  measured: { width: number; height: number };
  /**
   * The node's source and target handles, each its own leaf: a pass that
   * moves only the source handles leaves the readers of the target handles
   * alone. Each list is immutable (the ingest deep-freezes it), so the stores
   * serve it RAW by identity and an equal list is no write at all. Both are
   * `undefined` until the node is measured, and again while it is hidden, so
   * unhiding re-measures.
   */
  handleSource?: Handle[] | null;
  handleTarget?: Handle[] | null;
};

/**
 * A measurement produced by the DOM ingest (measureNodeInternals), destined
 * for the measurements root. A `hidden` write clears the node's handle bounds
 * (so unhiding triggers a re-measure) without dropping its measured
 * dimensions.
 */
export type NodeMeasurementWrite =
  | { id: string; hidden: true }
  | {
      id: string;
      hidden?: undefined;
      measured: { width: number; height: number };
      handleBounds: NodeHandleBounds;
    };

/**
 * The measurements root: DOM-derived state keyed by node id, kept OUTSIDE the
 * user graph. Keyed reconcile strips keys a derive doesn't produce, so state
 * that outlives a controlled nodes-array reset (measured dimensions, handle
 * bounds) needs its own writable root — the two-root architecture from the
 * P3.2 spike.
 */
export type NodeMeasurements = Record<string, NodeMeasurement>;

/** A node's absolute rect as the row derive computes it (renderer space). */
export type NodeGeometry = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly parentId?: string;
};

export type InternalNodesSource<NodeType extends Node = Node> = {
  readonly nodes: readonly NodeType[];
  readonly measurements: NodeMeasurements;
  /** Flow-driven selection sidecar, joined with `userNode.selected` per row. */
  readonly selectionOverlay: SelectionOverlay;
  /** Drag-position sidecar, joined with `userNode.position` per row. */
  readonly dragOverlay: DragOverlay;
  readonly nodeOrigin: NodeOrigin;
  readonly nodeExtent: CoordinateExtent;
  readonly onError?: (id: string, message: string) => void;
  readonly elevateNodesOnSelect: boolean;
  /** For each row's part of its edges' drawn z (see edgeZOf). */
  readonly elevateEdgesOnSelect?: boolean;
  readonly zIndexMode?: ZIndexMode;
  /**
   * Called with a row's absolute rect (and parentId) whenever it changes, and
   * with `null` when the row is removed — the one place geometry is known the
   * moment it changes. Gesture starts read the resulting plain map instead of
   * walking every row through the store proxies (bench round 23).
   */
  readonly onGeometryChange?: (id: string, rect: NodeGeometry | null) => void;
  /**
   * Called with whether the row is pinned (nodePinned: never culled for a
   * reason of its own) on every run, and with `false` when it is removed.
   */
  readonly reportCullPin?: (id: string, pinned: boolean) => void;
  /** Filled with each row's endpoint version (see EndpointVersions). */
  readonly endpointVersions?: EndpointVersions;
  /**
   * Called with whether the row is selected (overlay joined), and whether it
   * is unmeasured (visible, without a measured or declared size), on every
   * run; `false` when it is removed. They feed the flow's selected and
   * unmeasured records (projections/reportedIds.ts).
   */
  readonly reportSelected?: (id: string, selected: boolean) => void;
  readonly reportUnmeasured?: (id: string, unmeasured: boolean) => void;
  /**
   * Reactive, read when a row is created (untracked): rows start COLD and
   * are created on first read (#22). The unmount tier's mode, where a row
   * off screen is never read; with everything mounted every row is read at
   * mount anyway, so rows start hot there.
   */
  readonly lazyRows?: boolean;
};

/**
 * Per node id, the row store's `endpoint`: a counter that changes whenever
 * anything an edge draws from the node changes (its absolute position, size,
 * measured size, handles). An edge's row reads the two counters and the
 * endpoints' geometry untracked, so it subscribes to two sources instead of
 * a dozen leaves of each endpoint.
 */
export type EndpointVersions = Map<string, { readonly endpoint?: number }>;

/** Reads a node's part of its edges' drawn z (see edgeZOf) by node id. */
export type EdgeZReader = (nodeId: string) => number;

const edgeZReaders = new WeakMap<object, EdgeZReader>();

/**
 * The edge z reader of an internalNodes record: a tracked read of the id's
 * record slot (a re-created row repoints it, and the reader runs again),
 * then of that row store's `edgeZ`. Two reads per endpoint, against six
 * through the record facade and the row (bench round 80).
 */
export const edgeZReaderOf = (internalNodes: object): EdgeZReader => {
  const reader = edgeZReaders.get(internalNodes);
  if (!reader) throw new Error("edgeZReaderOf: not an internalNodes record");
  return reader;
};

/** Whether anything an edge draws from the node differs between two states. */
const endpointChanged = (prev: RowState, next: RowState): boolean =>
  next.x !== prev.x ||
  next.y !== prev.y ||
  next.width !== prev.width ||
  next.height !== prev.height ||
  next.measuredWidth !== prev.measuredWidth ||
  next.measuredHeight !== prev.measuredHeight ||
  next.handleSource !== prev.handleSource ||
  next.handleTarget !== prev.handleTarget;

const EMPTY_AUTO_INDEX: ReadonlyMap<string, number> = new Map();

/**
 * The adoption pass, decomposed into SUB-STORES (spike 13): each row is its
 * own keyed projection — user node joined with the measurements root into an
 * InternalNode (absolute position with origin/extent clamping and parent
 * offsets, z ordering, measured dimensions/handle bounds) — and the public
 * record is a SHALLOW projection holding the row-store proxies by reference.
 *
 * Reads chain: `record[id].internals.positionAbsolute.x` goes through the
 * shallow slot into the row's own store, so every materialized leaf signal
 * hangs off its ROW's computed, not one monolithic record computed. This is
 * what defeats rc.1's per-update companion walk (`updateChildCompanions`
 * walks a store computed's entire `_child` chain on every update — O(all
 * materialized signals) for a monolithic record, O(one row) here). A node
 * move re-runs one row projection (plus its children's); the record computed
 * re-runs only on membership changes.
 *
 * Row proxy identity is stable for a row's lifetime, and there is no write
 * side: nodes-array resets, membership changes, and measurement updates all
 * converge by derivation.
 *
 * Parents may come anywhere in the array (@xyflow/system 1.0): a row is
 * positioned from its parent when its ancestor chain reaches a root through
 * nodes that exist. A row whose chain does not (a missing ancestor, or a
 * parentId cycle) keeps its own position and reports, matching upstream's
 * unresolved children. Because links follow only chains that end at a root,
 * no row derive ever reads a row that reads it back.
 */
export const createInternalNodes = <NodeType extends Node = Node>(
  source: InternalNodesSource<NodeType>,
): Record<string, InternalNode<NodeType>> => {
  // Root parents get staggered z blocks in "auto" mode, indexed in the order
  // their first child resolves (upstream: rootParentIndex). A child of a root
  // parent resolves once both have been reached in the array: at the later
  // of the two slots. Depends only on membership and parentId slots — node
  // moves do not re-run it.
  const autoIndex: Accessor<ReadonlyMap<string, number>> = createMemo(
    () => {
      if (source.zIndexMode !== "auto") return EMPTY_AUTO_INDEX;

      const nodes = source.nodes;
      const parentOf: (string | undefined)[] = [];
      const slotOf = new Map<string, number>();
      for (let slot = 0; slot < nodes.length; slot++) {
        const node = nodes[slot]!;
        parentOf.push(node.parentId);
        slotOf.set(node.id, slot);
      }
      // root parent id → the slot at which its first child resolves
      const resolvedAt = new Map<string, number>();
      for (let slot = 0; slot < parentOf.length; slot++) {
        const parentId = parentOf[slot];
        if (!parentId) continue;
        const parentSlot = slotOf.get(parentId);
        if (parentSlot === undefined || parentOf[parentSlot]) continue;
        const at = Math.max(parentSlot, slot);
        const known = resolvedAt.get(parentId);
        if (known === undefined || at < known) resolvedAt.set(parentId, at);
      }
      const index = new Map<string, number>();
      const order = [...resolvedAt].sort((a, b) => a[1] - b[1]);
      for (const [parentId] of order) index.set(parentId, index.size + 1);
      return index;
    },
    { name: "autoIndex" },
  );

  // The flow settings every row reads, as ONE memo (value-equal): one read
  // per row run instead of four through the config getters (~19 ms of any
  // 10k-row pass), and a config change that leaves them equal re-runs no
  // row (bench round 41).
  const settings = createMemo(
    (): RowSettings => ({
      nodeOrigin: source.nodeOrigin,
      nodeExtent: source.nodeExtent,
      zIndexMode: source.zIndexMode,
      elevateNodesOnSelect: source.elevateNodesOnSelect,
      elevateEdgesOnSelect: source.elevateEdgesOnSelect,
    }),
    {
      equals: (a, b) =>
        a.nodeOrigin === b.nodeOrigin &&
        a.nodeExtent === b.nodeExtent &&
        a.zIndexMode === b.zIndexMode &&
        a.elevateNodesOnSelect === b.elevateNodesOnSelect &&
        a.elevateEdgesOnSelect === b.elevateEdgesOnSelect,
      name: "internalNodes.settings",
    },
  );

  type RowStore = { row: InternalNode<NodeType> | null; endpoint?: number; edgeZ?: number };

  // id → the row's registration (user node, row store created on first use).
  const entryById = new Map<string, RowEntry<NodeType, RowStore>>();

  // Presence of one id, as a small memo per id a child walks through: a
  // child subscribes to each ancestor's presence, so only adding or removing
  // one of ITS ancestors re-runs it. A read of the whole mapArray re-ran
  // every child on any membership change (17 -> 61 ms per added node with
  // 9,900 children); a keyed presence record cost ~+60 ms on that mount
  // (a projection leaf read from a row derive is ~4 us). All lazy: nothing
  // computes until a child reads it, so a flow without subflows never does,
  // and each memo goes away with its last subscriber.
  const rowIds = createMemo(() => new Set(rows().map((entry) => entry.id)), {
    lazy: true,
    name: "internalNodes.rowIds",
  });
  const owner = getOwner();
  const presenceById = new Map<string, Accessor<boolean>>();
  const presenceOf = (id: string): Accessor<boolean> => {
    let presence = presenceById.get(id);
    if (presence === undefined) {
      // Owned by the flow, not by the row that asked first: rows share it.
      presence = runWithOwner(owner, () =>
        createMemo(() => rowIds().has(id), {
          lazy: true,
          unobserved: () => presenceById.delete(id),
          name: "internalNodes.presence",
        }),
      );
      presenceById.set(id, presence);
    }
    return presence;
  };

  /**
   * The row of `parentId` when the row `id` is positioned from it: the
   * ancestor chain reaches a root through existing nodes. Subscribes to the
   * presence and the parentId of each ancestor it walks, so a write that
   * adds or removes an ancestor, or breaks or closes the chain, re-runs the
   * row; reading the parent's row store subscribes to exactly the parent
   * leaves the child's geometry depends on. Only rows with a parent call
   * this, and those are created after `rows` below has returned (see
   * RowEntry's `store`).
   */
  const linkedParent = (id: string, parentId: string | undefined) => {
    if (!parentId) return undefined;
    // The walk decides from the registrations; bringing the mapArray up to
    // date first registers rows created in the same write. Untracked: the
    // presence reads below are the subscription (a stale presence read only
    // costs a re-run, never a wrong link).
    untrack(rows);
    const parentEntry = entryById.get(parentId);
    const seen = new Set([id]);
    let entry = parentEntry;
    let ancestorId = parentId;
    presenceOf(ancestorId)();
    while (entry && !seen.has(ancestorId)) {
      seen.add(ancestorId);
      const next = entry.item().parentId;
      if (!next) return parentEntry?.store.row ?? undefined;
      ancestorId = next;
      presenceOf(ancestorId)();
      entry = entryById.get(ancestorId);
    }
    emitFlowError(
      source.onError,
      "parent-missing",
      `Parent node with id "${parentId}" is missing for child node with id "${id}"`,
    );
    return undefined;
  };

  const rows = mapArray(
    () => source.nodes,
    (userNodeAccessor) => {
      const id = userNodeAccessor().id;
      // The row rides in a `{ row }` wrapper (matching resolvedEdges): the
      // wrapper is what keeps TS happy across the Store<T>=Readonly<T>
      // mapped type with an unresolved NodeType generic, and the inner
      // `.row` proxy is what the public record holds.
      // One reporter for the cold memo and the row derive: whichever reports
      // writes the feed only when the rect (or the linked parent) changed.
      let geometryKey = "";
      const reportGeometry = (
        rect: { x: number; y: number; width: number; height: number },
        parentId: string | undefined,
      ) => {
        if (!source.onGeometryChange) return;
        const key = `${rect.x},${rect.y},${rect.width},${rect.height},${parentId ?? ""}`;
        if (key === geometryKey) return;
        geometryKey = key;
        source.onGeometryChange(id, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          ...(parentId ? { parentId } : {}),
        });
      };
      const createRow = (): RowStore => {
        // ONE enumeration of the user row per USER change: the projection
        // reads this plain snapshot, so a measurement or overlay change
        // re-runs the geometry without re-spreading the proxy — the spread ran
        // three times per node at a 10k mount, each pass ~170 ms of trap self
        // time plus a presence node per key (bench round 30, solidjs/solid#3664).
        const userKeys = createUserKeys(userNodeAccessor);
        const userSnapshot = createMemo(() => snapshotUserRow(userNodeAccessor(), userKeys()), {
          name: "internalNodes.user",
        });
        // Two write paths (bench round 34). A user-snapshot change (or a swapped
        // user object) RETURNS a fresh row and lets the engine reconcile it —
        // the cheap path for a ~25-key change, and what keeps the userNode
        // copy in sync. A geometry-only run (measurement, overlay, drag,
        // parent move) writes the few leaves that changed IN PLACE, against
        // the previous run's state (writeChangedLeaves): writing all ~25 keys
        // through the draft cost twice the reconcile.
        let lastUser: NodeType | undefined;
        let lastUserNode: NodeType | undefined;
        let last: RowState | undefined;
        let endpoint = 0;
        let edgeZ = 0;
        // Seeded with a null row (rowRecord's "not present"); the first run
        // always returns a full row, so a reader never sees the seed.
        const store: RowStore = createProjection<RowStore>(
          (draft) => {
            // the accessor tracks the item slot: a controlled array reset swaps
            // the user node object while THIS row store (keyed by id) survives,
            // so downstream subscriptions never strand on disposed stores
            const userNode = userNodeAccessor();
            const user = userSnapshot();

            // Position/dragging = drag overlay joined with the row; the joined
            // position feeds the row field AND the absolute-position derive.
            const dragOverlayEntry = dragEntry(source.dragOverlay, user.id);
            const parent = linkedParent(id, user.parentId);
            const rowSettings = settings();
            const next = computeRowState(
              user,
              {
                // Selection = overlay joined with the row (solid#3085
                // composition); the same value feeds the row and z elevation.
                // Read from the row PROXY (the snapshot skips the joined keys).
                selected: joinSelected(
                  userNode.selected,
                  overlayEntry(source.selectionOverlay, user.id),
                ),
                dragging: joinDragging(userNode.dragging, dragOverlayEntry),
                position: joinPosition(user.position, dragOverlayEntry),
                // `in` guard: subscribes even while the key is absent, so the
                // first measurement of a node re-runs (absent-key footgun).
                measurement:
                  user.id in source.measurements ? source.measurements[user.id] : undefined,
                rootParentIndex: autoIndex().get(user.id),
              },
              rowSettings,
              parent,
            );

            // The parentId only for a parent this row is positioned from: the
            // geometry consumers walk it (a parentId cycle recursed forever).
            reportGeometry(next, parent ? user.parentId : undefined);
            source.reportSelected?.(id, next.selected);
            source.reportUnmeasured?.(
              id,
              !user.hidden &&
                (next.measuredWidth === undefined || next.measuredHeight === undefined),
            );

            source.reportCullPin?.(
              id,
              nodePinned(
                next.selected,
                user.cullable,
                next.measuredWidth,
                next.measuredHeight,
                next.handleSource !== undefined || !!user.handles?.length,
              ),
            );

            const prev = last;
            last = next;
            // The user's `handles` (unmeasured handle positions) are an
            // endpoint input too; they arrive on the reconcile path.
            if (
              prev === undefined ||
              endpointChanged(prev, next) ||
              user.handles !== lastUser?.handles
            ) {
              endpoint++;
            }
            const nextEdgeZ = edgeZOf(user.parentId, next, rowSettings);
            if (prev === undefined || user !== lastUser || userNode !== lastUserNode) {
              lastUser = user;
              lastUserNode = userNode;
              edgeZ = nextEdgeZ;
              return { row: buildRow(user, userNode, next), endpoint, edgeZ };
            }
            const row = draft.row;
            if (row) writeChangedLeaves(row, prev, next);
            if (draft.endpoint !== endpoint) draft.endpoint = endpoint;
            if (nextEdgeZ !== edgeZ) {
              edgeZ = nextEdgeZ;
              draft.edgeZ = edgeZ;
            }
            return undefined;
          },
          { row: null },
          { key: "id", name: "internalNodes.row" },
        );
        source.endpointVersions?.set(id, store);
        return store;
      };

      const entry = new RowEntry(id, userNodeAccessor, getOwner(), createRow);
      entryById.set(id, entry);
      // mapArray creates replacement rows BEFORE disposing removed ones, so
      // only delete the registration this row actually owns.
      onCleanup(() => {
        if (entryById.get(id) === entry) {
          entryById.delete(id);
          source.onGeometryChange?.(id, null);
          source.reportSelected?.(id, false);
          source.reportUnmeasured?.(id, false);
          source.reportCullPin?.(id, false);
        }
        const created = entry.created;
        if (created && source.endpointVersions?.get(id) === created) {
          source.endpointVersions.delete(id);
        }
      });

      // A derive runs as its projection is created. A child's derive reads
      // rows that may come later in the array, so a row with a parent is
      // created on first use, under its own owner: by the record projection
      // below once every row of the pass is registered, or earlier by a
      // descendant that links to it. Eager rows without a parent are created
      // here. A LAZY root row (#22) stays cold until something reads it (a
      // renderer mounting it, an edge, the record): until then a small memo
      // keeps its rect and cull pin current, which is all culling needs.
      if (!untrack(() => source.lazyRows)) {
        if (!untrack(() => userNodeAccessor().parentId)) void entry.store;
        return entry;
      }
      // eslint-disable-next-line solid/reactivity -- a memo nobody reads: it reports to the plain feeds, like the row derive
      createMemo(
        () => {
          // Hot: the row derive reports from now on (this run drops the deps).
          if (entry.created) return;
          const userNode = userNodeAccessor();
          // ONE key-set read, then only the keys the row has: a read of an
          // absent key is a subscription too, and a declared node carries
          // ~5 of the ~12 keys below (the key set re-runs this on an add).
          const keys = Object.keys(userNode);
          const read = <K extends keyof NodeType>(key: K): NodeType[K] | undefined =>
            keys.includes(String(key)) ? userNode[key] : undefined;
          // A row with a parent is created by the record pass (subflows are hot).
          if (read("parentId")) return;
          const measurement = id in source.measurements ? source.measurements[id] : undefined;
          const measured = read("measured");
          const measuredWidth = measurement?.measured.width ?? measured?.width;
          const measuredHeight = measurement?.measured.height ?? measured?.height;
          reportGeometry(
            coldRootRect(
              {
                id,
                origin: read("origin"),
                extent: read("extent"),
                width: read("width"),
                height: read("height"),
                initialWidth: read("initialWidth"),
                initialHeight: read("initialHeight"),
              },
              joinPosition(userNode.position, dragEntry(source.dragOverlay, id)),
              measuredWidth,
              measuredHeight,
              settings(),
            ),
            undefined,
          );
          const selected = joinSelected(
            read("selected"),
            overlayEntry(source.selectionOverlay, id),
          );
          source.reportCullPin?.(
            id,
            nodePinned(
              selected,
              read("cullable"),
              measuredWidth,
              measuredHeight,
              measurement?.handleSource !== undefined || !!read("handles")?.length,
            ),
          );
          source.reportSelected?.(id, selected);
          source.reportUnmeasured?.(
            id,
            !read("hidden") && (measuredWidth === undefined || measuredHeight === undefined),
          );
        },
        { name: "internalNodes.cold" },
      );
      return entry;
    },
    { keyed: (userNode) => userNode.id },
  );

  // The record over the row ENTRIES: building it heats nothing; a read of
  // `record[id]` creates that row. Rows with a parent are created here, once
  // every row of the pass is registered (only cold ones are asked: the read
  // re-runs the pass when a cold row gains a parent). The holders also serve
  // the rows' edge z (edgeZReaderOf).
  const holders = createEntryHolders<
    InternalNode<NodeType>,
    RowStore,
    RowEntry<NodeType, RowStore>
  >(rows, "internalNodes", (entry) => !entry.created && !!entry.item().parentId);
  const record = createRecordFacade(holders);
  edgeZReaders.set(record, (nodeId) => holders[nodeId]?.store.edgeZ ?? 0);
  return record;
};
