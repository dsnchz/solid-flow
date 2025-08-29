import { getStraightPath } from "@xyflow/system";
import { createMemo } from "solid-js";

import type { StraightEdgeProps } from "../../../types";
import { BaseEdge } from "./BaseEdge";

export const StraightEdge = (props: StraightEdgeProps) => {
  const pathData = createMemo(() => {
    const [path, labelX, labelY] = getStraightPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
    });

    return { path, labelX, labelY };
  });

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
