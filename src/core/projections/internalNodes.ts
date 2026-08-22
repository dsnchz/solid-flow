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
import { createProjection } from "solid-js";

import type { InternalNode, Node } from "~/types";

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
  readonly nodeOrigin: NodeOrigin;
  readonly nodeExtent: CoordinateExtent;
  readonly elevateNodesOnSelect: boolean;
  readonly zIndexMode?: ZIndexMode;
};

/**
 * The adoption pass as a projection: user nodes joined with the measurements
 * root into `Record<string, InternalNode>` — absolute positions (origin,
 * extent clamping, parent offsets), z ordering (selection elevation, parent
 * stacking), and measured dimensions/handle bounds.
 *
 * Row identity is stable across derives (keyed reconcile), and unlike the old
 * ReactiveMap adoption pipeline there is no write side: nodes-array resets,
 * membership changes, and measurement updates all converge by derivation.
 *
 * Nodes must come before their children in the array (upstream contract);
 * a child whose parent has not been adopted yet keeps its own position and
 * warns, matching @xyflow/system.
 */
export const createInternalNodes = <NodeType extends Node = Node>(
  source: InternalNodesSource<NodeType>,
): Record<string, InternalNode<NodeType>> => {
  return createProjection<Record<string, InternalNode<NodeType>>>(
    () => {
      const { nodeOrigin, nodeExtent, zIndexMode } = source;
      const selectedNodeZ =
        source.elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0;
      const out: Record<string, InternalNode<NodeType>> = {};
      let rootParentCount = 0;

      for (const userNode of source.nodes) {
        // `in` guard: subscribes even while the key is absent, so the first
        // measurement of a node re-derives (projection absent-key footgun).
        const measurement =
          userNode.id in source.measurements ? source.measurements[userNode.id] : undefined;

        // User-provided dimensions win; otherwise the last DOM measurement.
        const measured = {
          width: userNode.measured?.width ?? measurement?.measured.width,
          height: userNode.measured?.height ?? measurement?.measured.height,
        };
        const dimensions = getNodeDimensions({
          measured,
          width: userNode.width,
          height: userNode.height,
          initialWidth: userNode.initialWidth,
          initialHeight: userNode.initialHeight,
        });

        const row = {
          ...userNode,
          measured,
          internals: {
            positionAbsolute: clampPosition(
              getNodePositionWithOrigin(userNode, nodeOrigin),
              isCoordinateExtent(userNode.extent) ? userNode.extent : nodeExtent,
              dimensions,
            ),
            handleBounds: measurement?.handleBounds,
            z: calculateZ(userNode, selectedNodeZ, zIndexMode),
            userNode,
          },
        } as InternalNode<NodeType>;

        if (userNode.parentId) {
          const parent = out[userNode.parentId];

          if (!parent) {
            console.warn(
              `Parent node ${userNode.parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`,
            );
          } else {
            // Root parents get staggered z blocks in "auto" mode, assigned in
            // order of first-child appearance (upstream: rootParentIndex).
            if (
              !parent.parentId &&
              zIndexMode === "auto" &&
              parent.internals.rootParentIndex === undefined
            ) {
              parent.internals.rootParentIndex = ++rootParentCount;
              parent.internals.z += rootParentCount * ROOT_PARENT_Z_INCREMENT;
            }

            const { x, y, z } = calculateChildXYZ(
              row,
              parent,
              nodeOrigin,
              nodeExtent,
              selectedNodeZ,
              zIndexMode,
            );
            row.internals.positionAbsolute = { x, y };
            row.internals.z = z;
          }
        }

        out[userNode.id] = row;
      }

      return out;
    },
    {},
    { key: "id" },
  );
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
