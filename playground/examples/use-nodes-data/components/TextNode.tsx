import type { JSX } from "solid-js";

import { Handle, type NodeProps, useSolidFlow } from "@/index";

export const TextNode = (props: NodeProps<{ text: string }, "text">) => {
  const { updateNodeData } = useSolidFlow();

  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (evt) => {
    updateNodeData(props.id, { text: evt.currentTarget.value });
  };

  return (
    <div class="custom">
      <div>node {props.id}</div>
      <div>
        <input value={props.data.text} onInput={handleInput} />
      </div>
      <Handle type="source" position="right" />
    </div>
  );
};
