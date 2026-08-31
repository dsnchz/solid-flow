import {
  evaluateAbsolutePosition,
  getNodesBounds as systemGetNodesBounds,
  getOverlappingArea,
  isRectObject,
  type NodeLookup,
  type NodeOrigin,
  nodeToRect,
  type Rect,
} from "@xyflow/system";
import { untrack } from "solid-js";

import type { Edge, InternalNode, Node } from "@/types";
import { isNode } from "@/utils";

import type { FlowCommands } from "../flowState";
import { SpatialGrid } from "../spatial/grid";

/** The slice of the internal store the geometry queries read. */
type GeometryStoreReads<NodeType extends Node> = {
  readonly nodes: readonly NodeType[];
  readonly nodeOrigin: NodeOrigin;
};

export type GeometryCommandDeps<NodeType extends Node> = {
  readonly store: GeometryStoreReads<NodeType>;
  readonly nodeLookup: NodeLookup<InternalNode<NodeType>>;
};

/**
 * Geometry query group: rect-based intersection questions over the graph.
 * Pure pull API — no graph writes, no subscriptions (see the grid note).
 */
export const createGeometryCommands = <NodeType extends Node, EdgeType extends Edge>({
  store,
  nodeLookup,
}: GeometryCommandDeps<NodeType>) => {
  // A microtask-lifetime spatial grid over node rects: always rebuilt at
  // most once per task (no invalidation seams to miss — geometry writes in
  // the same task were already visible when the first query built it, and
  // the next task rebuilds). Untracked: this is a pull API, not a
  // subscription (a reactive index would recreate the round-6
  // central-collection anti-pattern).
  let intersectionGrid: SpatialGrid | null = null;
  let intersectionRows: Map<string, NodeType> | null = null;
  const queryIntersectionCandidates = (rect: Rect): NodeType[] =>
    untrack(() => {
      if (!intersectionGrid) {
        const grid = new SpatialGrid(300);
        const rows = new Map<string, NodeType>();
        for (const node of store.nodes) {
          const internalNode = nodeLookup.get(node.id);
          if (!internalNode) continue;
          grid.insert(node.id, nodeToRect(internalNode));
          rows.set(node.id, node);
        }
        intersectionGrid = grid;
        intersectionRows = rows;
        queueMicrotask(() => {
          intersectionGrid = null;
          intersectionRows = null;
        });
      }
      const rows = intersectionRows!;
      const result: NodeType[] = [];
      for (const id of intersectionGrid.queryRect(rect)) {
        const row = rows.get(id);
        if (row) result.push(row);
      }
      return result;
    });

  const getNodeRect = (node: NodeType | { id: NodeType["id"] }): Rect | null => {
    const nodeToUse = isNode<NodeType>(node) ? node : nodeLookup.get(node.id);
    if (!nodeToUse) return null;
    const position = nodeToUse.parentId
      ? evaluateAbsolutePosition(
          nodeToUse.position,
          nodeToUse.measured,
          nodeToUse.parentId,
          nodeLookup,
          store.nodeOrigin,
        )
      : nodeToUse.position;

    const nodeWithPosition = {
      ...nodeToUse,
      position,
      width: nodeToUse.measured?.width ?? nodeToUse.width,
      height: nodeToUse.measured?.height ?? nodeToUse.height,
    };

    return nodeToRect(nodeWithPosition);
  };

  const commands = {
    getIntersectingNodes: (nodeOrRect, partially = true, nodesToIntersect) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) return [];

      // RFC-4239 win #2: with no explicit subset, narrow candidates through
      // the microtask-cached grid — collision patterns calling this per
      // dragged node per frame share ONE build and drop from O(n) per call
      // to O(candidates). The exact predicate below is unchanged.
      const candidates = nodesToIntersect ?? queryIntersectionCandidates(nodeRect);

      return candidates.filter((n) => {
        const internalNode = nodeLookup.get(n.id);
        if (!internalNode || (!isRect && n.id === nodeOrRect.id)) {
          return false;
        }

        const currNodeRect = nodeToRect(internalNode);
        const overlappingArea = getOverlappingArea(currNodeRect, nodeRect);
        const partiallyVisible = partially && overlappingArea > 0;

        return partiallyVisible || overlappingArea >= nodeRect.width * nodeRect.height;
      });
    },
    isNodeIntersecting: (nodeOrRect, area, partially = true) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) return false;

      const overlappingArea = getOverlappingArea(nodeRect, area);
      const partiallyVisible = partially && overlappingArea > 0;

      return partiallyVisible || overlappingArea >= nodeRect.width * nodeRect.height;
    },
    getNodesBounds: (nodesToMeasure) => {
      return systemGetNodesBounds(nodesToMeasure, { nodeLookup, nodeOrigin: store.nodeOrigin });
    },
  } satisfies Partial<FlowCommands<NodeType, EdgeType>>;

  return commands;
};
