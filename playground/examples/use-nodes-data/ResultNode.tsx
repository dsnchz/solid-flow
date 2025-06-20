import { Position } from "@xyflow/system";
import { For } from "solid-js";

import { Handle, useNodeConnections, useNodesData } from "@/index";
import type { NodeProps } from "@/types";

import { isTextNode, type MyNode } from "./types";

export const ResultNode = (props: NodeProps<Record<string, never>, "result">) => {
  const connections = useNodeConnections(() => ({
    id: props.id,
    handleType: "target" as const,
  }));

  const sources = () => connections().map((connection) => connection.source);
  const nodeData = useNodesData<MyNode>(sources);
  const textNodes = () => nodeData().filter(isTextNode);

  return (
    <div class="custom">
      <Handle type="target" position={Position.Left} />
      <div>incoming texts:</div>
      <For each={textNodes()}>{(textNode) => <div>{textNode.data.text}</div>}</For>
    </div>
  );
};
