import { Position } from "@xyflow/system";
import { type Accessor, type Setter } from "solid-js";

import { Handle } from "@/components";
import type { NodeProps } from "@/types";

type CustomColorNodeData = {
  backgroundColor: Accessor<string>;
  setBackgroundColor: Setter<string>;
};

export const CustomColorNode = (props: NodeProps<CustomColorNodeData, "colorNode">) => {
  const handleColorChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    props.data.setBackgroundColor(target.value);
  };

  return (
    <div
      class="custom-color-node"
      style={{
        "background-color": "white",
        padding: "10px",
        border: "1px solid #777",
        "border-radius": "20px",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div>
        Custom Color Picker Node: <strong>{props.data.backgroundColor()}</strong>
      </div>
      <input
        class="nodrag"
        type="color"
        onInput={handleColorChange}
        value={props.data.backgroundColor()}
      />
      <Handle type="source" position={Position.Right} id="a" style={{ top: "20px" }} />
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{ top: "auto", bottom: "10px" }}
      />
    </div>
  );
};
