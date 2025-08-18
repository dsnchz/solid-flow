import {
  type Connection,
  type EdgeBase,
  getNodesInside,
  type NodeLookup,
  type Transform,
} from "@xyflow/system";

import type { InternalNode, Node } from "../types";

export const getEdgeId = (connection: Connection | EdgeBase) => {
  const { source, sourceHandle, target, targetHandle } = connection;
  return `xy-edge__${source}${sourceHandle || ""}-${target}${targetHandle || ""}`;
};

export function getVisibleNodes<NodeType extends Node = Node>(
  nodeLookup: NodeLookup<InternalNode<NodeType>>,
  transform: Transform,
  width: number,
  height: number,
) {
  const visibleNodes = new Map<string, InternalNode<NodeType>>();
  getNodesInside(nodeLookup, { x: 0, y: 0, width: width, height: height }, transform, true).forEach(
    (node) => {
      visibleNodes.set(node.id, node);
    },
  );
  return visibleNodes;
}
