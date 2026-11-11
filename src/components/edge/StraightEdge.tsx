import { getStraightPath } from "@xyflow/system";

import type { StraightEdgeProps } from "@/types";

import { createPathEdge } from "./pathEdge";

// A straight edge ignores the handle sides: the renderer's variant does not take them.
type StraightPathProps = Omit<StraightEdgeProps, "sourcePosition" | "targetPosition">;

const straightPath = (edge: StraightPathProps) =>
  getStraightPath({
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    targetX: edge.targetX,
    targetY: edge.targetY,
  });

/** Built-in straight edge component. */
export const StraightEdge = createPathEdge<StraightEdgeProps>(straightPath, true);

/** Renderer-internal straight edge variant. */
export const StraightEdgeInternal = createPathEdge(straightPath, false);
