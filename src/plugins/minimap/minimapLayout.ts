import type { Rect } from "@xyflow/system";

export type MinimapFrameInput = {
  /** What the minimap must show: the graph's bounds joined with the visible viewport. */
  readonly bounds: Rect;
  /** The minimap's own size in px. */
  readonly width: number;
  readonly height: number;
  /** Padding around `bounds`, in minimap px (scaled by the view scale). */
  readonly offsetScale: number;
};

/** The svg's viewBox (x, y, width, height): `bounds` fitted to the minimap's aspect, centered, padded. */
export type MinimapFrame = Rect & {
  /** Flow units per minimap px. */
  readonly viewScale: number;
  /** The padding, in flow units. */
  readonly offset: number;
};

/** The minimap's frame from what it must show and its own size (upstream's math). */
export const minimapFrame = ({
  bounds,
  width,
  height,
  offsetScale,
}: MinimapFrameInput): MinimapFrame => {
  const viewScale = Math.max(bounds.width / width, bounds.height / height);
  const viewWidth = viewScale * width;
  const viewHeight = viewScale * height;
  const offset = offsetScale * viewScale;
  return {
    viewScale,
    offset,
    x: bounds.x - (viewWidth - bounds.width) / 2 - offset,
    y: bounds.y - (viewHeight - bounds.height) / 2 - offset,
    width: viewWidth + offset * 2,
    height: viewHeight + offset * 2,
  };
};

/**
 * The mask: the frame grown by one more offset, with the visible viewport
 * cut out of it (drawn with an even-odd fill).
 */
export const minimapMaskPath = (frame: MinimapFrame, view: Rect): string => {
  const { x, y, width, height, offset } = frame;
  const outer = `M${x - offset},${y - offset}h${width + offset * 2}v${height + offset * 2}h${-width - offset * 2}z`;
  const inner = `M${view.x},${view.y}h${view.width}v${view.height}h${-view.width}z`;
  return `${outer} ${inner}`;
};
