import { getStraightPath } from "@xyflow/system";

import type { StraightEdgeProps } from "@/types";

import { BaseEdge } from "./BaseEdge";

export const StraightEdgeInternal = (
  props: Omit<StraightEdgeProps, "sourcePosition" | "targetPosition">,
) => {
  const pathData = () => {
    const [path, labelX, labelY] = getStraightPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
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
