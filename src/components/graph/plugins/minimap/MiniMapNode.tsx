import clsx from "clsx";
import { type JSX, mergeProps } from "solid-js";

type MinimapNodeProps = {
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
};

export const MiniMapNode = (props: MinimapNodeProps) => {
  const _props = mergeProps(
    {
      borderRadius: 5,
      width: 0,
      height: 0,
    },
    props,
  );

  const style = () =>
    Object.entries({
      fill: _props.color,
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
      class={clsx("solid-flow__minimap-node", { selected: _props.selected }, _props.class)}
      x={_props.x}
      y={_props.y}
      rx={_props.borderRadius}
      ry={_props.borderRadius}
      width={_props.width}
      height={_props.height}
      shape-rendering={_props.shapeRendering}
      style={style()}
    />
  );
};
