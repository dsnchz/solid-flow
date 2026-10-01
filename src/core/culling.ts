import type { Rect, Transform } from "@xyflow/system";
import { type Accessor, createMemo } from "solid-js";

import type { InternalNode, Node, ResolvedEdge } from "@/types";

import type { OnScreenIds } from "./projections/onScreenIds";

/**
 * The reactive inputs of the culling viewport, expressed structurally so the
 * internal store satisfies it and headless tests can supply a plain object.
 */
export type CullingSource = {
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
 * least the actual visible area. Returns `null` while the flow container is
 * unmeasured — consumers treat `null` as "cull nothing".
 */
export const createCullingViewport = (source: CullingSource): Accessor<Rect | null> =>
  createMemo(
    () => {
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
    { equals: rectsEqual, name: "cullingViewport" },
  );

/**
 * Row-level culling over the on-screen membership (bench rounds 26 and 52).
 * The never-cull guards live here — inactive culling, selected, `cullable:
 * false`, unmeasured, handle bounds not yet populated in this instance — and
 * the rect overlap is the membership's job. `onScreen.has(id)` subscribes to
 * that row's own signal (see projections/onScreenIds.ts).
 */
export const nodeCulled = <NodeType extends Node>(
  node: InternalNode<NodeType>,
  cullingActive: boolean,
  onScreen: OnScreenIds,
): boolean => {
  if (!cullingActive || node.selected || node.cullable === false) return false;
  const { width, height } = node.measured;
  if (!width || !height) return false;
  if (!node.internals.handleBounds) return false;
  return !onScreen.has(node.id);
};

export const edgeCulled = (
  row: Pick<ResolvedEdge, "id" | "selected" | "cullable">,
  cullingActive: boolean,
  onScreen: OnScreenIds,
): boolean => {
  if (!cullingActive || row.selected || row.cullable === false) return false;
  return !onScreen.has(row.id);
};
