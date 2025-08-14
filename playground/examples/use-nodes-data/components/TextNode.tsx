import { Position } from "@xyflow/system";
import type { JSX } from "solid-js";

import { Handle, useSolidFlow } from "@/index";
import type { NodeProps } from "@/types";

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
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
