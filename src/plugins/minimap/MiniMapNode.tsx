import type { JSX } from "@solidjs/web";

import { cx } from "@/utils";

/**
 * Props passed to a minimap node renderer — the default `MiniMapNode` or a
 * custom component supplied via the `MiniMap` `nodeComponent` prop. Position
 * and dimensions are in flow coordinates (the minimap svg's viewBox space).
 */
export type MiniMapNodeProps = {
  /** The id of the node this minimap representation stands for. */
  readonly id: string;
  readonly class?: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly borderRadius?: number;
  readonly color?: string;
  readonly shapeRendering: JSX.RectSVGAttributes<SVGRectElement>["shape-rendering"];
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
  readonly selected?: boolean;
  /** The node's own style; its background feeds the default fill fallback. */
  readonly style?: JSX.CSSProperties;
  /** Click handler (wired when the `MiniMap` has `onNodeClick`); call with the node id. */
  readonly onClick?: (event: MouseEvent, id: string) => void;
};

/** The default minimap node: a rounded rect. Custom `nodeComponent`s can wrap it. */
export const MiniMapNode = (props: MiniMapNodeProps): JSX.Element => {
  // One per node while a MiniMap is shown: the per-row rules (see Handle).
  // `??` accessors for the defaults instead of a propDefaults getter object,
  // a class string, and the style built in place.
  const radius = () => props.borderRadius ?? 5;

  const style = () => {
    const out: Record<string, string | number> = {};
    // Upstream parity: an explicit nodeColor wins, then the node's own
    // background shines through onto the minimap.
    const fill = props.color ?? props.style?.background ?? props.style?.["background-color"];
    if (fill !== undefined) out.fill = fill;
    if (props.strokeColor !== undefined) out.stroke = props.strokeColor;
    if (props.strokeWidth !== undefined) out["stroke-width"] = props.strokeWidth;
    return out;
  };

  return (
    <rect
      class={cx("solid-flow__minimap-node", props.selected && "selected", props.class)}
      x={props.x}
      y={props.y}
      rx={radius()}
      ry={radius()}
      width={props.width ?? 0}
      height={props.height ?? 0}
      shape-rendering={props.shapeRendering}
      style={style()}
      // Read at click time (a handler set after mount must reach it); click
      // is delegated, so this is a property per node, not a listener.
      onClick={(event) => props.onClick?.(event, props.id)}
    />
  );
};
