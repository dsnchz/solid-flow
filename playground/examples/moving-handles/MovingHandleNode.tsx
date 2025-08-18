import { Position } from "@xyflow/system";
import type { JSX } from "solid-js";

import { Handle, useConnection } from "@/index";
import type { NodeProps } from "@/types";

const sourceHandleStyle: JSX.CSSProperties = {
  position: "relative",
  transform: "translate(-50%, 0)",
  top: 0,
  transition: "transform 0.5s",
};

export const MovingHandleNode = (_props: NodeProps<Record<string, never>, "movingHandle">) => {
  const connection = useConnection();

  return (
    <>
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          position: "absolute",
          left: 0,
          top: 0,
          "justify-content": "space-around",
          height: "100%",
        }}
      >
        <Handle
          type="target"
          id="a"
          position={Position.Left}
          style={{
            ...sourceHandleStyle,
            transform: connection().inProgress ? "translate(-20px, 0)" : "translate(-50%, 0)",
          }}
        />
        <Handle
          type="target"
          id="b"
          position={Position.Left}
          style={{
            ...sourceHandleStyle,
            transform: connection().inProgress ? "translate(-20px, 0)" : "translate(-50%, 0)",
          }}
        />
      </div>
      <div
        style={{
          background: "#f4f4f4",
          padding: "10px",
        }}
      >
        <div>moving handles</div>
        <Handle type="source" position={Position.Right} />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  );
};
