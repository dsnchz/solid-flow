import type { Rect, Transform } from "@xyflow/system";
import { type Accessor, createMemo } from "solid-js";

import type { EdgeLayouted, InternalNode, Node } from "@/types";

/**
 * The reactive inputs of the culling viewport, expressed structurally so the
 * internal store satisfies it and headless tests can supply a plain object.
 */
export type CullingSource = {
  readonly onlyRenderVisibleElements: boolean;
  readonly width: number;
  readonly height: number;
  readonly transform: Transform;
};

/**
 * Overscan margin per side, as a fraction of the (zoom-bucketed) viewport
 * dimension. Elements inside the margin stay visible while off-screen —
 * pop-in insurance and churn damping (#15 design doc §4.2).
 */
const OVERSCAN = 0.5;

/** Quantization step as a fraction of the viewport dimension (= OVERSCAN/2). */
const STEP = OVERSCAN / 2;

const rectsEqual = (a: Rect | null, b: Rect | null): boolean =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;

/**
 * The culling viewport: the visible flow-space rect inflated by the overscan
 * margin and QUANTIZED, so panning inside the margin produces the same memo
 * value (nothing downstream recomputes) and the per-element sweeps only run
 * when the camera crosses a quantization boundary — never per frame.
 *
 * Zoom is bucketed into powers of two so the rect's dimensions are stable
 * within a bucket; the bucket floor guarantees the rect always covers at
 * least the actual visible area. Returns `null` while culling is disabled or
 * the flow container is unmeasured — consumers treat `null` as "cull
 * nothing", which keeps the disabled path free of geometry reads.
 */
export const createCullingViewport = (source: CullingSource): Accessor<Rect | null> =>
  createMemo(
    () => {
      if (!source.onlyRenderVisibleElements) return null;

      const { width, height } = source;
      if (!width || !height) return null;

      const [tx, ty, zoom] = source.transform;

      // Bucketed dimensions: zoom >= bucket, so bucketed dims >= actual dims.
      const zoomBucket = 2 ** Math.floor(Math.log2(zoom));
      const bucketWidth = width / zoomBucket;
      const bucketHeight = height / zoomBucket;

      // Quantize the flow-space camera center to the step grid.
      const stepX = bucketWidth * STEP;
      const stepY = bucketHeight * STEP;
      const centerX = (width / 2 - tx) / zoom;
      const centerY = (height / 2 - ty) / zoom;
      const quantizedX = Math.round(centerX / stepX) * stepX;
      const quantizedY = Math.round(centerY / stepY) * stepY;

      // Half-extent = bucketed half-dimension + overscan margin. Worst-case
      // margin beyond the visible edge stays >= (2 * OVERSCAN - 1 - STEP/2)/2
      // of the bucketed dimension (> 0 for OVERSCAN = 0.5).
      const halfWidth = bucketWidth * (0.5 + OVERSCAN);
      const halfHeight = bucketHeight * (0.5 + OVERSCAN);

      return {
        x: quantizedX - halfWidth,
        y: quantizedY - halfHeight,
        width: 2 * halfWidth,
        height: 2 * halfHeight,
      };
    },
    { equals: rectsEqual },
  );

/**
 * Whether a node's DOM element should be CSS-hidden (culled). Selected nodes
 * are never culled (keyboard focus and toolbars survive off-screen), and
 * unmeasured nodes are left to the pre-measurement visibility path — culling
 * must never starve the measurement pipeline.
 */
export const isNodeCulled = <NodeType extends Node>(
  node: InternalNode<NodeType>,
  cullingViewport: Rect | null,
): boolean => {
  if (!cullingViewport || node.selected) return false;

  const { width, height } = node.measured;
  if (!width || !height) return false;

  const { x, y } = node.internals.positionAbsolute;
  return !rectsOverlap({ x, y, width, height }, cullingViewport);
};

/**
 * Whether an edge's DOM element should be CSS-hidden (culled): the AABB of
 * its layouted endpoints (the drawn segment's box) against the culling
 * viewport. Selected edges are never culled. The overscan margin absorbs
 * curvature overshoot beyond the endpoint box.
 */
export const isEdgeCulled = (
  row: Pick<EdgeLayouted, "sourceX" | "sourceY" | "targetX" | "targetY" | "selected">,
  cullingViewport: Rect | null,
): boolean => {
  if (!cullingViewport || row.selected) return false;

  const x = Math.min(row.sourceX, row.targetX);
  const y = Math.min(row.sourceY, row.targetY);

  return !rectsOverlap(
    {
      x,
      y,
      width: Math.abs(row.sourceX - row.targetX),
      height: Math.abs(row.sourceY - row.targetY),
    },
    cullingViewport,
  );
};
