import { Handle, type NodeProps, NodeToolbar, Position } from "@/index";

export type CustomNodeData = {
  toolbarVisible?: boolean;
  toolbarPosition: Position;
  toolbarAlign?: "start" | "center" | "end";
  label: string;
};

export const CustomNode = (props: NodeProps<CustomNodeData, "custom">) => {
  return (
    <>
      <NodeToolbar
        isVisible={props.data.toolbarVisible}
        position={props.data.toolbarPosition}
        align={props.data.toolbarAlign}
      >
        <button>delete</button>
        <button>copy</button>
        <button>expand</button>
      </NodeToolbar>
      <div
        class="node"
        style={{
          width: "180px",
          height: "50px",
          border: "solid 1px black",
          background: "white",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          position: "relative",
        }}
      >
        <div>{props.data.label}</div>
        <Handle type="target" position="left" />
        <Handle type="source" position="right" />
      </div>
    </>
  );
};
