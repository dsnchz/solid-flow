import {
  clampPosition,
  clampPositionToParent,
  type CoordinateExtent,
  getNodeDimensions,
  getNodePositionWithOrigin,
  isCoordinateExtent,
  isNumeric,
  type NodeHandleBounds,
  type NodeOrigin,
  type ZIndexMode,
} from "@xyflow/system";
import { type Accessor, createMemo, createProjection, mapArray, onCleanup } from "solid-js";

import type { InternalNode, Node } from "@/types";
import { emitFlowError } from "@/utils";

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
  /** Cleared (not deleted) while the node is hidden, so unhiding re-measures. */
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

export type InternalNodesSource<NodeType extends Node = Node> = {
  readonly nodes: readonly NodeType[];
  readonly measurements: NodeMeasurements;
  /** Flow-driven selection sidecar, joined with `userNode.selected` per row. */
  readonly selectionOverlay: SelectionOverlay;
  readonly nodeOrigin: NodeOrigin;
  readonly nodeExtent: CoordinateExtent;
  readonly onError?: (id: string, message: string) => void;
  readonly elevateNodesOnSelect: boolean;
  readonly zIndexMode?: ZIndexMode;
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
  const autoIndex: Accessor<ReadonlyMap<string, number>> = createMemo(() => {
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
  });

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
      const store: { row: InternalNode<NodeType> } = createProjection<{
        row: InternalNode<NodeType>;
      }>(
        () => {
          // the accessor tracks the item slot: a controlled array reset swaps
          // the user node object while THIS row store (keyed by id) survives,
          // so downstream subscriptions never strand on disposed stores
          const userNode = userNodeAccessor();
          const { nodeOrigin, nodeExtent, zIndexMode } = source;
          const selectedNodeZ =
            source.elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0;

          // `in` guard: subscribes even while the key is absent, so the first
          // measurement of a node re-runs (computation absent-key footgun).
          const measurement =
            userNode.id in source.measurements ? source.measurements[userNode.id] : undefined;

          // Selection = overlay joined with the row (solid#3085 composition);
          // the same value feeds the spread override and z elevation.
          const selected = joinSelected(
            userNode.selected,
            overlayEntry(source.selectionOverlay, userNode.id),
          );

          // The measurements root is authoritative once a DOM measurement
          // exists (the row write-through can't be relied on — it reverts on
          // optimistic stores); the user seed covers the pre-measurement
          // window (SSR sizing, persisted layouts).
          const measured = {
            width: measurement?.measured.width ?? userNode.measured?.width,
            height: measurement?.measured.height ?? userNode.measured?.height,
          };
          const dimensions = getNodeDimensions({
            measured,
            width: userNode.width,
            height: userNode.height,
            initialWidth: userNode.initialWidth,
            initialHeight: userNode.initialHeight,
          });

          const rootParentIndex = autoIndex().get(userNode.id);
          const row = {
            ...userNode,
            selected,
            measured,
            internals: {
              positionAbsolute: clampPosition(
                getNodePositionWithOrigin(userNode, nodeOrigin),
                isCoordinateExtent(userNode.extent) ? userNode.extent : nodeExtent,
                dimensions,
              ),
              handleBounds: measurement?.handleBounds,
              z:
                calculateZ({ zIndex: userNode.zIndex, selected }, selectedNodeZ, zIndexMode) +
                (rootParentIndex !== undefined ? rootParentIndex * ROOT_PARENT_Z_INCREMENT : 0),
              ...(rootParentIndex !== undefined ? { rootParentIndex } : {}),
              userNode,
            },
          } as InternalNode<NodeType>;

          if (userNode.parentId) {
            const parentEntry = entryById.get(userNode.parentId);
            // Only link backwards: matches the upstream parents-first contract
            // and rules out parentId-cycle recursion. Reading the parent's row
            // store subscribes to exactly the parent leaves the child's
            // geometry depends on.
            if (parentEntry && parentEntry.index() < index()) {
              const { x, y, z } = calculateChildXYZ(
                row,
                parentEntry.store.row,
                nodeOrigin,
                nodeExtent,
                selectedNodeZ,
                zIndexMode,
              );
              row.internals.positionAbsolute = { x, y };
              row.internals.z = z;
            } else {
              // Subscribe to membership so the row re-runs if the parent is
              // added (or reordered to the front) later.
              void source.nodes.length;
              emitFlowError(
                source.onError,
                "parent-missing",
                `Parent node ${userNode.parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`,
              );
            }
          }

          return { row };
        },
        {},
        { key: "id" },
      );

      const entry = { store, index };
      entryById.set(id, entry);
      // mapArray creates replacement rows BEFORE disposing removed ones, so
      // only delete the registration this row actually owns.
      onCleanup(() => {
        if (entryById.get(id) === entry) entryById.delete(id);
      });

      return { id, store };
    },
    { keyed: (userNode) => userNode.id },
  );

  // Shared keyed-record tail — see createRowRecordProjection. (These rows
  // are never null; the helper's null-skip is a no-op here.)
  return createRowRecordProjection(rowStores);
};

function calculateChildXYZ<NodeType extends Node>(
  childNode: InternalNode<NodeType>,
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
