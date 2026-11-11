import { getSmoothStepPath } from "@xyflow/system";

import type { StepEdgeProps } from "@/types";

import { createPathEdge } from "./pathEdge";

// A step edge is a smooth-step edge with square corners.
const stepPath = (edge: StepEdgeProps) =>
  getSmoothStepPath({
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    targetX: edge.targetX,
    targetY: edge.targetY,
    sourcePosition: edge.sourcePosition,
    targetPosition: edge.targetPosition,
    borderRadius: 0,
    offset: edge.pathOptions?.offset,
  });

/** Built-in step edge component. */
export const StepEdge = createPathEdge(stepPath, true);

/** Renderer-internal step edge variant. */
export const StepEdgeInternal = createPathEdge(stepPath, false);
