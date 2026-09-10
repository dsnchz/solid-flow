import { createEffect, createMemo } from "solid-js";

import { Handle, type NodeProps, useNodeConnections, useNodesData, useSolidFlow } from "@/index";

import { isTextNode, type MyNode } from "./types";

export const UppercaseNode = (props: NodeProps<{ text: string }, "uppercase">) => {
  const { updateNodeData } = useSolidFlow();

  const connections = useNodeConnections(() => ({
    id: props.id,
    handleType: "target",
  }));

  const nodeData = useNodesData<MyNode>(() => connections()[0]?.source);
  const textNodeData = createMemo(() => (isTextNode(nodeData()) ? nodeData()!.data.text : null));

  // Solid 2 effect shape: the first function only READS (it is the tracked,
  // owned scope; a store write there is REACTIVE_WRITE_IN_OWNED_SCOPE), the
  // second performs the write with the computed value.
  createEffect(
    () => textNodeData()?.toUpperCase() ?? "",
    (text) => {
      updateNodeData(props.id, { text });
    },
  );

  return (
    <div class="custom">
      <Handle type="target" position="left" isConnectable={connections().length === 0} />
      <div>uppercase transform</div>
      <Handle type="source" position="right" />
    </div>
  );
};
