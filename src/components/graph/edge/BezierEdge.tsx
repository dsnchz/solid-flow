import { getBezierPath } from "@xyflow/system";

import type { BezierEdgeProps } from "@/types";

import { BaseEdge } from "./BaseEdge";

export const BezierEdge = (props: BezierEdgeProps) => {
  const pathData = () => {
    const [path, labelX, labelY] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
      curvature: props.pathOptions?.curvature,
    });

    return { path, labelX, labelY };
  };

  return (
    <BaseEdge
      id={props.id}
      path={pathData().path}
      labelX={pathData().labelX}
      labelY={pathData().labelY}
      label={props.label}
      labelStyle={props.labelStyle}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      interactionWidth={props.interactionWidth}
      style={props.style}
    />
  );
};
