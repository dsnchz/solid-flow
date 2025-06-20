import { getBezierPath } from "@xyflow/system";
import { createMemo, Show } from "solid-js";

import { BaseEdge } from "@/components/graph/edge";
import { EdgeLabel, EdgeReconnectAnchor } from "@/index";
import type { EdgeProps } from "@/types";

export const ButtonEdge = (props: EdgeProps) => {
  const pathData = createMemo(() => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
    });

    return { edgePath, labelX, labelY };
  });

  const handleClick = () => {
    alert("Button edge clicked!");
  };

  return (
    <>
      <BaseEdge path={pathData().edgePath} markerEnd={props.markerEnd} style={props.style} />
      <EdgeLabel x={pathData().labelX} y={pathData().labelY}>
        <button
          onClick={handleClick}
          style={{
            width: "20px",
            height: "20px",
            background: "#eee",
            border: "1px solid #fff",
            cursor: "pointer",
            "border-radius": "50%",
            "font-size": "12px",
            "line-height": "1",
          }}
        >
          ×
        </button>
      </EdgeLabel>
      <Show when={props.selected}>
        <EdgeReconnectAnchor type="source" position={{ x: props.sourceX, y: props.sourceY }} />
        <EdgeReconnectAnchor type="target" position={{ x: props.targetX, y: props.targetY }} />
      </Show>
    </>
  );
};
