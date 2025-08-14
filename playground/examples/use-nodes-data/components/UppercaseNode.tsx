import { Position } from "@xyflow/system";
import { createEffect, createMemo, untrack } from "solid-js";

import { Handle, useNodeConnections, useNodesData, useSolidFlow } from "@/index";
import type { NodeProps } from "@/types";

import { isTextNode, type MyNode } from "./types";

export const UppercaseNode = (props: NodeProps<{ text: string }, "uppercase">) => {
  const { updateNodeData } = useSolidFlow();

  const connections = useNodeConnections(() => ({
    id: props.id,
    handleType: "target",
  }));

  const nodeData = useNodesData<MyNode>(() => connections()[0]?.source);
  const textNodeData = createMemo(() => (isTextNode(nodeData()) ? nodeData()!.data.text : null));

  createEffect(() => {
    const input = textNodeData()?.toUpperCase() ?? "";
    // Use untrack to prevent the effect from being triggered by updateNodeData
    untrack(() => updateNodeData(props.id, { text: input }));
  });

  return (
    <div class="custom">
      <Handle type="target" position={Position.Left} isConnectable={connections().length === 0} />
      <div>uppercase transform</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
