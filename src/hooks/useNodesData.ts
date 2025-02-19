import { type Accessor, createMemo } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import type { Node } from "@/shared/types";

type NodeData<NodeType extends Node> = Pick<NodeType, "id" | "data" | "type">;

/**
 * Hook for receiving data of one or multiple nodes
 *
 * @param nodeId - The id (or ids) of the node to get the data from
 * @returns A memo with an array of data objects
 */
export function useNodesData<NodeType extends Node = Node>(
  nodeId: string,
): Accessor<NodeData<NodeType> | null>;
export function useNodesData<NodeType extends Node = Node>(
  nodeIds: string[],
): Accessor<NodeData<NodeType>[]>;
export function useNodesData(nodeIds: string | string[]) {
  const { store } = useFlowStore();

  const result = createMemo(() => {
    const isArrayOfIds = Array.isArray(nodeIds);

    const _nodeIds = isArrayOfIds ? nodeIds : [nodeIds];
    const nodesData = [];

    for (const nodeId of _nodeIds) {
      const node = store.nodeLookup.get(nodeId)?.internals.userNode;

      if (!node) continue;

      nodesData.push({
        id: node.id,
        type: node.type,
        data: node.data,
      });
    }

    return isArrayOfIds ? nodesData : (nodesData[0] ?? null);
  });

  return result;
}
