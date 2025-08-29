import { getSmoothStepPath } from "@xyflow/system";

import type { StepEdgeProps } from "../../../types";
import { BaseEdge } from "./BaseEdge";

export const StepEdgeInternal = (props: StepEdgeProps) => {
  const pathData = () => {
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
      borderRadius: 0,
    });

    return { path, labelX, labelY };
  };

  return (
    <BaseEdge
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
