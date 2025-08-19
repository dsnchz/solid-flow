import "./CustomEdge3.css";

import { getSmoothStepPath } from "@xyflow/system";
import { createMemo } from "solid-js";

import { BaseEdge } from "@/components/graph/edge";
import { EdgeLabel } from "@/index";
import type { EdgeProps } from "@/types";

export const CustomEdge3 = (props: EdgeProps<{ text: string }>) => {
  const pathData = createMemo(() => {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    });

    return { edgePath, labelX, labelY };
  });

  return (
    <>
      <BaseEdge
        id={props.id}
        path={pathData().edgePath}
        class="solid-flow__edge-custom3"
        style={{
          "stroke-dasharray": "100",
          "stroke-dashoffset": "100",
          animation: "solid-flow-edge-dash 1s linear forwards",
        }}
      />
      <EdgeLabel
        x={pathData().labelX}
        y={pathData().labelY - 5}
        style={{
          background: "transparent",
          "font-size": "12px",
        }}
        onClick={() => console.log(props.data)}
      >
        {props.data?.text}
      </EdgeLabel>
    </>
  );
};
