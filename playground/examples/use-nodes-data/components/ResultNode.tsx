import { For } from "solid-js";

import { Handle, type NodeProps, useNodeConnections, useNodesData } from "~/index";

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
      <Handle type="target" position="left" />
      <div>incoming texts:</div>
      <For each={textNodes()}>{(textNode) => <div>{textNode.data.text}</div>}</For>
    </div>
  );
};
