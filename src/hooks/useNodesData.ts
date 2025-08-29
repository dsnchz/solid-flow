import { shallowNodeData } from "@xyflow/system";
import { type Accessor, createMemo } from "solid-js";

import { useInternalSolidFlow } from "~/components/contexts";
import type { Node } from "~/types";

type NodeData<NodeType extends Node> = Pick<NodeType, "id" | "data" | "type">;

/**
 * Hook for receiving data of one or multiple nodes
 *
 * @param nodeId - The id (or ids) of the node to get the data from
 * @returns A memo with an array of data objects
 */
export function useNodesData<NodeType extends Node = Node>(
  nodeId: Accessor<string | undefined | null>,
): Accessor<NodeData<NodeType> | undefined>;
export function useNodesData<NodeType extends Node = Node>(
  nodeIds: Accessor<string[] | undefined | null>,
): Accessor<NodeData<NodeType>[]>;
export function useNodesData<NodeType extends Node = Node>(
  nodeIds: Accessor<string | string[] | undefined | null>,
) {
  const { nodeLookup } = useInternalSolidFlow();

  let prevNodesData = [] as NodeData<NodeType>[];

  const result = createMemo(() => {
    const nodesData = [] as NodeData<NodeType>[];

    const idValues = nodeIds();

    if (!idValues) return undefined;

    const ids = Array.isArray(idValues) ? idValues : [idValues];

    for (const nodeId of ids) {
      const node = nodeLookup.get(nodeId)?.internals.userNode;

      if (!node) continue;

      nodesData.push({
        id: node.id,
        type: node.type,
        data: node.data,
      });
    }

    if (!shallowNodeData(nodesData, prevNodesData)) {
      prevNodesData = nodesData;
    }

    return Array.isArray(idValues) ? nodesData : nodesData[0];
  });

  return result;
}
