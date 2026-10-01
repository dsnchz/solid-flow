import type { CoordinateExtent, NodeHandleBounds, NodeOrigin, ZIndexMode } from "@xyflow/system";
import { type Accessor, createMemo, createProjection, mapArray, onCleanup } from "solid-js";

import type { InternalNode, Node } from "@/types";

import { dragEntry, type DragOverlay, joinDragging, joinPosition } from "../dragOverlay";
import { emitFlowError } from "../rules";
import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import {
  buildRow,
  computeRowState,
  type RowSettings,
  type RowState,
  writeChangedLeaves,
} from "./internalNodeRow";
import { createRowRecordProjection } from "./rowRecord";

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
   * Cleared (not deleted) while the node is hidden, so unhiding re-measures.
   * An immutable record (the ingest deep-freezes it): the stores serve it
   * RAW by identity, so a changed measurement is a replaced slot and an
   * equal one is no write at all — the row rebuild and the edge layouts
   * compare it by reference.
   */
  handleBounds?: NodeHandleBounds;
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
  readonly zIndexMode?: ZIndexMode;
  /**
   * Called (untracked, plain) whenever a row's derive lands a different
   * absolute position or size — the graph's geometry "version" for consumers
   * that sample instead of subscribe (the minimap's bounds). Not reactive
   * state by design: a signal write inside a derive is forbidden.
   */
  /**
   * Called with a row's absolute rect (and parentId) whenever it changes, and
   * with `null` when the row is removed — the one place geometry is known the
   * moment it changes. Gesture starts read the resulting plain map instead of
   * walking every row through the store proxies (bench round 23).
   */
  readonly onGeometryChange?: (id: string, rect: NodeGeometry | null) => void;
};

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
 * Nodes must come before their children in the array (upstream contract);
 * a child whose parent has not been adopted yet keeps its own position and
 * warns, matching @xyflow/system. Rows link only backwards in the array,
 * which also makes parentId cycles unrepresentable.
 */
export const createInternalNodes = <NodeType extends Node = Node>(
  source: InternalNodesSource<NodeType>,
): Record<string, InternalNode<NodeType>> => {
  // Root parents get staggered z blocks in "auto" mode, indexed in order of
  // first-child appearance (upstream: rootParentIndex). Depends only on
  // membership and parentId slots — node moves do not re-run it.
  const autoIndex: Accessor<ReadonlyMap<string, number>> = createMemo(
    () => {
      if (source.zIndexMode !== "auto") return EMPTY_AUTO_INDEX;

      const index = new Map<string, number>();
      const rootIds = new Set<string>();
      for (const node of source.nodes) {
        if (!node.parentId) {
          rootIds.add(node.id);
        } else if (rootIds.has(node.parentId) && !index.has(node.parentId)) {
          index.set(node.parentId, index.size + 1);
        }
      }
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
    }),
    {
      equals: (a, b) =>
        a.nodeOrigin === b.nodeOrigin &&
        a.nodeExtent === b.nodeExtent &&
        a.zIndexMode === b.zIndexMode &&
        a.elevateNodesOnSelect === b.elevateNodesOnSelect,
      name: "internalNodes.settings",
    },
  );

  // id → row store (+ array position, to enforce the parents-first contract).
  const entryById = new Map<
    string,
    { store: { row: InternalNode<NodeType> }; index: Accessor<number> }
  >();

  const rowStores = mapArray(
    () => source.nodes,
    (userNodeAccessor, index) => {
      const id = userNodeAccessor().id;
      // The row rides in a `{ row }` wrapper (matching resolvedEdges): the
      // wrapper is what keeps TS happy across the Store<T>=Readonly<T>
      // mapped type with an unresolved NodeType generic, and the inner
      // `.row` proxy is what the public record holds.
      let geometryKey = "";
      // The parent's row when this row links to it: only backwards (the
      // upstream parents-first contract, which also rules out parentId
      // cycles). Reading the parent's row store subscribes to exactly the
      // parent leaves the child's geometry depends on. A parent not found
      // (or not yet in front) reports, and the row keeps its own position.
      const linkedParent = (parentId: string | undefined) => {
        if (!parentId) return undefined;
        const parentEntry = entryById.get(parentId);
        if (parentEntry && parentEntry.index() < index()) return parentEntry.store.row;
        // Subscribe to membership so the row re-runs if the parent is added
        // (or reordered to the front) later.
        void source.nodes.length;
        emitFlowError(
          source.onError,
          "parent-missing",
          `Parent node ${parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`,
        );
        return undefined;
      };
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
      const store: { row: InternalNode<NodeType> } = createProjection<{
        row: InternalNode<NodeType>;
      }>(
        (draft) => {
          // the accessor tracks the item slot: a controlled array reset swaps
          // the user node object while THIS row store (keyed by id) survives,
          // so downstream subscriptions never strand on disposed stores
          const userNode = userNodeAccessor();
          const user = userSnapshot();

          // Position/dragging = drag overlay joined with the row; the joined
          // position feeds the row field AND the absolute-position derive.
          const dragOverlayEntry = dragEntry(source.dragOverlay, user.id);
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
            settings(),
            linkedParent(user.parentId),
          );

          if (source.onGeometryChange) {
            const key = `${next.x},${next.y},${next.width},${next.height},${user.parentId ?? ""}`;
            if (key !== geometryKey) {
              geometryKey = key;
              source.onGeometryChange(id, {
                x: next.x,
                y: next.y,
                width: next.width,
                height: next.height,
                ...(user.parentId ? { parentId: user.parentId } : {}),
              });
            }
          }

          const prev = last;
          last = next;
          if (prev === undefined || user !== lastUser || userNode !== lastUserNode) {
            lastUser = user;
            lastUserNode = userNode;
            return { row: buildRow(user, userNode, next) };
          }
          writeChangedLeaves(draft.row, prev, next);
          return undefined;
        },
        {},
        { key: "id", name: "internalNodes.row" },
      );

      const entry = { store, index };
      entryById.set(id, entry);
      // mapArray creates replacement rows BEFORE disposing removed ones, so
      // only delete the registration this row actually owns.
      onCleanup(() => {
        if (entryById.get(id) === entry) {
          entryById.delete(id);
          source.onGeometryChange?.(id, null);
        }
      });

      return { id, store };
    },
    { keyed: (userNode) => userNode.id },
  );

  // Shared keyed-record tail — see createRowRecordProjection. (These rows
  // are never null; the helper's null-skip is a no-op here.)
  return createRowRecordProjection(rowStores, "internalNodes");
};
