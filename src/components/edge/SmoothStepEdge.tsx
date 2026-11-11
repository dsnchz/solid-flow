import { getSmoothStepPath } from "@xyflow/system";

import type { SmoothStepEdgeProps } from "@/types";

import { createPathEdge } from "./pathEdge";

const smoothStepPath = (edge: SmoothStepEdgeProps) =>
  getSmoothStepPath({
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    targetX: edge.targetX,
    targetY: edge.targetY,
    sourcePosition: edge.sourcePosition,
    targetPosition: edge.targetPosition,
    borderRadius: edge.pathOptions?.borderRadius,
    offset: edge.pathOptions?.offset,
    stepPosition: edge.pathOptions?.stepPosition,
  });

/** Built-in smooth-step edge component. */
export const SmoothStepEdge = createPathEdge(smoothStepPath, true);

/** Renderer-internal smooth-step edge variant. */
export const SmoothStepEdgeInternal = createPathEdge(smoothStepPath, false);
