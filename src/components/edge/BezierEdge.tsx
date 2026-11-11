import { getBezierPath } from "@xyflow/system";

import type { BezierEdgeProps } from "@/types";

import { createPathEdge } from "./pathEdge";

const bezierPath = (edge: BezierEdgeProps) =>
  getBezierPath({
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    targetX: edge.targetX,
    targetY: edge.targetY,
    sourcePosition: edge.sourcePosition,
    targetPosition: edge.targetPosition,
    curvature: edge.pathOptions?.curvature,
  });

/** Built-in bezier edge component. */
export const BezierEdge = createPathEdge(bezierPath, true);

/** Renderer-internal bezier edge variant. */
export const BezierEdgeInternal = createPathEdge(bezierPath, false);
