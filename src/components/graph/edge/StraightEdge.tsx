import { getStraightPath } from "@xyflow/system";
import { type Component } from "solid-js";

import type { StraightEdgeProps } from "@/shared/types";

import BaseEdge from "./BaseEdge";

const StraightEdge: Component<StraightEdgeProps> = (props) => {
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

export default StraightEdge;
