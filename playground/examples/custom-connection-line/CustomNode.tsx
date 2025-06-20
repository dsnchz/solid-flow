import { Handle } from "@/components";
import type { NodeProps } from "@/types";

const handleStyle = {
  width: "10px",
  height: "10px",
  bottom: "-5px",
};

export const CustomNode = (props: NodeProps<{ label: string }, "custom">) => {
  return (
    <div style={{ background: "#DDD", padding: "25px" }}>
      <div>Node</div>
      <Handle
        id="red"
        type="source"
        position="bottom"
        style={{
          ...handleStyle,
          left: "15%",
          background: "red",
        }}
        isConnectable={props.isConnectable}
      />
      <Handle
        id="blue"
        type="source"
        position="bottom"
        style={{
          ...handleStyle,
          left: "50%",
          background: "blue",
        }}
        isConnectable={props.isConnectable}
      />
      <Handle
        id="orange"
        type="source"
        position="bottom"
        style={{
          ...handleStyle,
          left: "85%",
          background: "orange",
        }}
        isConnectable={props.isConnectable}
      />
    </div>
  );
};
