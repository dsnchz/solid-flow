import type { JSX } from "@solidjs/web";
import { getBezierPath } from "@xyflow/system";

import type { BezierEdgeProps } from "@/types";

import { BaseEdge } from "./BaseEdge";

/** Renderer-internal bezier edge variant. */
export const BezierEdgeInternal = (props: BezierEdgeProps): JSX.Element => {
  const pathData = () => {
    const [path, labelX, labelY] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
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
