import type { JSX } from "@solidjs/web";

import { propDefaults } from "@/utils";

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
  const _props = propDefaults(props, {
    borderRadius: 5,
    width: 0,
    height: 0,
  });

  // Upstream parity: an explicit nodeColor wins, then the node's own
  // background shines through onto the minimap.
  const fill = () => _props.color ?? _props.style?.background ?? _props.style?.["background-color"];

  const style = () =>
    Object.entries({
      fill: fill(),
      stroke: _props.strokeColor,
      "stroke-width": _props.strokeWidth,
    })
      .filter(([_, value]) => value !== undefined)
      .reduce<Record<string, string | number>>((acc, [key, value]) => {
        acc[key] = value!;
        return acc;
      }, {});

  return (
    <rect
      class={["solid-flow__minimap-node", { selected: !!_props.selected }, _props.class]}
      x={_props.x}
      y={_props.y}
      rx={_props.borderRadius}
      ry={_props.borderRadius}
      width={_props.width}
      height={_props.height}
      shape-rendering={_props.shapeRendering}
      style={style()}
      onClick={_props.onClick ? (event) => _props.onClick!(event, _props.id) : undefined}
    />
  );
};
