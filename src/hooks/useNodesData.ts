import { shallowNodeData } from "@xyflow/system";
import { type Accessor, createMemo } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

type NodeData<NodeType extends Node> = Pick<NodeType, "id" | "data" | "type">;

/**
 * Reactive `id`, `type` and `data` of one node by id: `undefined` while the
 * id is missing (nothing connected yet) or names no node.
 */
export function useNodesData<NodeType extends Node = Node>(
  nodeId: Accessor<string | undefined | null>,
): Accessor<NodeData<NodeType> | undefined>;
/**
 * Reactive `id`, `type` and `data` of several nodes by id, in the order
 * given; ids that name no node are skipped. Always an array: pass
 * `() => ids() ?? []` for a list that may be missing.
 */
export function useNodesData<NodeType extends Node = Node>(
  nodeIds: Accessor<string[]>,
): Accessor<NodeData<NodeType>[]>;
export function useNodesData<NodeType extends Node = Node>(
  nodeIds: Accessor<string | string[] | undefined | null>,
): Accessor<NodeData<NodeType> | NodeData<NodeType>[] | undefined> {
  const { flow } = useInternalSolidFlow();

  let prevNodesData = [] as NodeData<NodeType>[];

  const result = createMemo(
    () => {
      const nodesData = [] as NodeData<NodeType>[];

      const idValues = nodeIds();

      if (!idValues) return undefined;

      const ids = Array.isArray(idValues) ? idValues : [idValues];

      for (const nodeId of ids) {
        const node = flow.internalNodes[nodeId]?.internals.userNode;

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
    },
    { name: "useNodesData" },
  );

  return result;
}
