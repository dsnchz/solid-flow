import {
  clampPosition,
  clampPositionToParent,
  type CoordinateExtent,
  getNodeDimensions,
  getNodePositionWithOrigin,
  isCoordinateExtent,
  isNumeric,
  type NodeBase,
  type NodeHandleBounds,
  type NodeOrigin,
  type ZIndexMode,
} from "@xyflow/system";
import { type Accessor, createMemo, createProjection, mapArray, onCleanup } from "solid-js";

import type { InternalNode, Node } from "@/types";
import { emitFlowError } from "@/utils";

import { dragEntry, type DragOverlay, joinDragging, joinPosition } from "../dragOverlay";
import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import { createRowRecordProjection } from "./rowRecord";

const SELECTED_NODE_Z = 1000;
const ROOT_PARENT_Z_INCREMENT = 10;

export function isManualZIndexMode(zIndexMode?: ZIndexMode): boolean {
  return zIndexMode === "manual";
}

export function calculateZ(
  node: Pick<Node, "zIndex" | "selected">,
  selectedNodeZ: number,
  zIndexMode?: ZIndexMode,
): number {
  const zIndex = isNumeric(node.zIndex) ? node.zIndex : 0;

  if (isManualZIndexMode(zIndexMode)) {
    return zIndex;
  }

  return zIndex + (node.selected ? selectedNodeZ : 0);
}

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

  // id → row store (+ array position, to enforce the parents-first contract).
  const entryById = new Map<
    string,
    { store: { row: InternalNode<NodeType> }; index: Accessor<number> }
  >();

  const rowStores = mapArray(
    () => source.nodes,
    (userNodeAccessor, index) => {
      const id = userNodeAccessor().id;
      // The row rides in a `{ row }` wrapper (matching layoutedEdges): the
      // wrapper is what keeps TS happy across the Store<T>=Readonly<T>
      // mapped type with an unresolved NodeType generic, and the inner
      // `.row` proxy is what the public record holds.
      let geometryKey = "";
      // ONE enumeration of the user row per USER change: the projection
      // reads this plain snapshot, so a measurement or overlay change
      // re-runs the geometry without re-spreading the proxy — the spread ran
      // three times per node at a 10k mount, each pass ~170 ms of trap self
      // time plus a presence node per key (bench round 30, solidjs/solid#3664).
      const userSnapshot = createMemo(() => ({ ...userNodeAccessor() }), {
        name: "internalNodes.user",
      });
      // Two write paths (bench round 34). A user-snapshot change (or a swapped
      // user object) RETURNS a fresh row and lets the engine reconcile it —
      // the cheap path for a ~25-key change, and what keeps the userNode
      // copy in sync. A geometry-only run (measurement, overlay, drag,
      // parent move) writes the few leaves that changed IN PLACE, compared
      // against closure-held last values so an unchanged leaf never touches
      // the draft: every draft read allocates a wrapper and every draft op
      // toggles the engine's write flags, so writing all ~25 keys through
      // the draft cost twice the reconcile.
      let lastUser: NodeType | undefined;
      let lastUserNode: NodeType | undefined;
      let lastSelected: boolean | undefined;
      let lastDragging: boolean | undefined;
      let lastPositionX = NaN;
      let lastPositionY = NaN;
      let lastWidth: number | undefined;
      let lastHeight: number | undefined;
      let lastX = NaN;
      let lastY = NaN;
      let lastZ = NaN;
      let lastHandleBounds: NodeHandleBounds | undefined;
      let lastRootParentIndex: number | undefined;
      const store: { row: InternalNode<NodeType> } = createProjection<{
        row: InternalNode<NodeType>;
      }>(
        (draft) => {
          // the accessor tracks the item slot: a controlled array reset swaps
          // the user node object while THIS row store (keyed by id) survives,
          // so downstream subscriptions never strand on disposed stores
          const userNode = userNodeAccessor();
          const user = userSnapshot();
          const { nodeOrigin, nodeExtent, zIndexMode } = source;
          const selectedNodeZ =
            source.elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0;

          // `in` guard: subscribes even while the key is absent, so the first
          // measurement of a node re-runs (computation absent-key footgun).
          const measurement =
            user.id in source.measurements ? source.measurements[user.id] : undefined;

          // Selection = overlay joined with the row (solid#3085 composition);
          // the same value feeds the spread override and z elevation.
          const selected = joinSelected(
            user.selected,
            overlayEntry(source.selectionOverlay, user.id),
          );
          // Position/dragging = drag overlay joined with the row; the joined
          // position feeds the row field AND the absolute-position derive.
          const dragOverlayEntry = dragEntry(source.dragOverlay, user.id);
          const position = joinPosition(user.position, dragOverlayEntry);
          const dragging = joinDragging(user.dragging, dragOverlayEntry);

          // The measurements root is authoritative once a DOM measurement
          // exists (the row write-through can't be relied on — it reverts on
          // optimistic stores); the user seed covers the pre-measurement
          // window (SSR sizing, persisted layouts).
          const measured = {
            width: measurement?.measured.width ?? user.measured?.width,
            height: measurement?.measured.height ?? user.measured?.height,
          };
          // The inputs the upstream geometry helpers read, as one small plain
          // object — not a spread of the user row per run.
          const geometry: RowGeometryInput = {
            id: user.id,
            data: user.data,
            position,
            origin: user.origin,
            extent: user.extent,
            zIndex: user.zIndex,
            selected,
            measured,
            width: user.width,
            height: user.height,
            initialWidth: user.initialWidth,
            initialHeight: user.initialHeight,
          };
          const dimensions = getNodeDimensions(geometry);

          const rootParentIndex = autoIndex().get(user.id);
          const absolute = clampPosition(
            getNodePositionWithOrigin(geometry, nodeOrigin),
            isCoordinateExtent(user.extent) ? user.extent : nodeExtent,
            dimensions,
          );
          let { x, y } = absolute;
          let z =
            calculateZ(geometry, selectedNodeZ, zIndexMode) +
            (rootParentIndex !== undefined ? rootParentIndex * ROOT_PARENT_Z_INCREMENT : 0);

          if (user.parentId) {
            const parentEntry = entryById.get(user.parentId);
            // Only link backwards: matches the upstream parents-first contract
            // and rules out parentId-cycle recursion. Reading the parent's row
            // store subscribes to exactly the parent leaves the child's
            // geometry depends on.
            if (parentEntry && parentEntry.index() < index()) {
              const child = calculateChildXYZ(
                geometry,
                parentEntry.store.row,
                nodeOrigin,
                nodeExtent,
                selectedNodeZ,
                zIndexMode,
              );
              x = child.x;
              y = child.y;
              z = child.z;
            } else {
              // Subscribe to membership so the row re-runs if the parent is
              // added (or reordered to the front) later.
              void source.nodes.length;
              emitFlowError(
                source.onError,
                "parent-missing",
                `Parent node ${user.parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`,
              );
            }
          }

          if (source.onGeometryChange) {
            const next = `${x},${y},${dimensions.width},${dimensions.height},${user.parentId ?? ""}`;
            if (next !== geometryKey) {
              geometryKey = next;
              source.onGeometryChange(id, {
                x,
                y,
                width: dimensions.width,
                height: dimensions.height,
                ...(user.parentId ? { parentId: user.parentId } : {}),
              });
            }
          }

          const handleBounds = measurement?.handleBounds;
          const previous = {
            selected: lastSelected,
            dragging: lastDragging,
            positionX: lastPositionX,
            positionY: lastPositionY,
            width: lastWidth,
            height: lastHeight,
            x: lastX,
            y: lastY,
            z: lastZ,
            handleBounds: lastHandleBounds,
            rootParentIndex: lastRootParentIndex,
          };
          lastSelected = selected;
          lastDragging = dragging;
          lastPositionX = position.x;
          lastPositionY = position.y;
          lastWidth = measured.width;
          lastHeight = measured.height;
          lastX = x;
          lastY = y;
          lastZ = z;
          lastHandleBounds = handleBounds;
          lastRootParentIndex = rootParentIndex;

          if (user !== lastUser || userNode !== lastUserNode) {
            lastUser = user;
            lastUserNode = userNode;
            // Geometry-owned objects are the row's own copies: the in-place
            // leaf writes below must never land in the user's or an
            // overlay's object.
            const row = {
              ...user,
              selected,
              position: { x: position.x, y: position.y },
              dragging,
              measured,
              internals: {
                positionAbsolute: { x, y },
                handleBounds,
                z,
                ...(rootParentIndex !== undefined ? { rootParentIndex } : {}),
                userNode,
              },
            } as InternalNode<NodeType>;
            return { row };
          }

          const row = draft.row;
          if (selected !== previous.selected) row.selected = selected;
          if (dragging !== previous.dragging) row.dragging = dragging;
          if (position.x !== previous.positionX || position.y !== previous.positionY) {
            const rowPosition = row.position;
            rowPosition.x = position.x;
            rowPosition.y = position.y;
          }
          if (measured.width !== previous.width || measured.height !== previous.height) {
            const rowMeasured = row.measured;
            rowMeasured.width = measured.width;
            rowMeasured.height = measured.height;
          }
          if (
            x !== previous.x ||
            y !== previous.y ||
            z !== previous.z ||
            handleBounds !== previous.handleBounds ||
            rootParentIndex !== previous.rootParentIndex
          ) {
            const { internals } = row;
            if (x !== previous.x || y !== previous.y) {
              const { positionAbsolute } = internals;
              positionAbsolute.x = x;
              positionAbsolute.y = y;
            }
            if (z !== previous.z) internals.z = z;
            if (handleBounds !== previous.handleBounds) internals.handleBounds = handleBounds;
            if (rootParentIndex !== previous.rootParentIndex) {
              if (rootParentIndex === undefined) delete internals.rootParentIndex;
              else internals.rootParentIndex = rootParentIndex;
            }
          }
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

/** The user-row fields the geometry derive reads, plus the joined values. */
type RowGeometryInput = Pick<
  NodeBase,
  | "id"
  | "data"
  | "position"
  | "origin"
  | "extent"
  | "zIndex"
  | "selected"
  | "measured"
  | "width"
  | "height"
  | "initialWidth"
  | "initialHeight"
>;

function calculateChildXYZ<NodeType extends Node>(
  childNode: RowGeometryInput,
  parentNode: InternalNode<NodeType>,
  nodeOrigin: NodeOrigin,
  nodeExtent: CoordinateExtent,
  selectedNodeZ: number,
  zIndexMode?: ZIndexMode,
) {
  const { x: parentX, y: parentY } = parentNode.internals.positionAbsolute;
  const childDimensions = getNodeDimensions(childNode);
  const positionWithOrigin = getNodePositionWithOrigin(childNode, nodeOrigin);
  const clampedPosition = isCoordinateExtent(childNode.extent)
    ? clampPosition(positionWithOrigin, childNode.extent, childDimensions)
    : positionWithOrigin;

  let absolutePosition = clampPosition(
    { x: parentX + clampedPosition.x, y: parentY + clampedPosition.y },
    nodeExtent,
    childDimensions,
  );

  if (childNode.extent === "parent") {
    absolutePosition = clampPositionToParent(absolutePosition, childDimensions, parentNode);
  }

  const childZ = calculateZ(childNode, selectedNodeZ, zIndexMode);
  const parentZ = parentNode.internals.z ?? 0;

  return {
    x: absolutePosition.x,
    y: absolutePosition.y,
    z: parentZ >= childZ ? parentZ + 1 : childZ,
  };
}
