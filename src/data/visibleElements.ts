import { getNodesInside, type NodeLookup, type Transform } from "@xyflow/system";

import type { InternalNode, Node } from "../types";

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
