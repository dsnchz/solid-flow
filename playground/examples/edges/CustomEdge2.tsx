import { createMemo } from "solid-js";

import { BaseEdge, EdgeLabel, type EdgeProps, getBezierPath } from "@/index";

export const CustomEdge2 = (props: EdgeProps<{ text: string }>) => {
  const pathData = createMemo(() => {
    const [edgePath, labelX, labelY] = getBezierPath({
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
      <BaseEdge id={props.id} path={pathData().edgePath} />
      <EdgeLabel
        x={pathData().labelX}
        y={pathData().labelY}
        style={{
          background: "red",
          color: "white",
          padding: "2px 4px",
          "border-radius": "2px",
          "font-size": "12px",
        }}
        onClick={() => console.log(props.data)}
      >
        {props.data?.text}
      </EdgeLabel>
    </>
  );
};
