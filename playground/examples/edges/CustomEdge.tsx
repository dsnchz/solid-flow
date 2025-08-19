import { getBezierPath } from "@xyflow/system";
import { createMemo } from "solid-js";

import { BaseEdge } from "@/components/graph/edge";
import type { EdgeProps } from "@/types";

export const CustomEdge = (props: EdgeProps<{ text: string }>) => {
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
      <BaseEdge path={pathData().edgePath} id={props.id} />
      <text>
        <textPath
          href={`#${props.id}`}
          style={{ "font-size": "12px" }}
          startOffset="50%"
          text-anchor="middle"
        >
          {props.data?.text}
        </textPath>
      </text>
    </>
  );
};
