import clsx from "clsx";
import type { JSX } from "solid-js";

type MinimapNodeProps = {
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
  readonly class?: string;
};

const MinimapNode = (props: MinimapNodeProps) => {
  const style = () =>
    Object.entries({
      fill: props.color,
      stroke: props.strokeColor,
      "stroke-width": props.strokeWidth,
    })
      .filter(([_, value]) => value !== undefined)
      .reduce<Record<string, string | number>>((acc, [key, value]) => {
        acc[key] = value!;
        return acc;
      }, {});

  return (
    <rect
      class={clsx("solid-flow__minimap-node", props.class)}
      classList={{ selected: props.selected }}
      x={props.x}
      y={props.y}
      rx={props.borderRadius ?? 5}
      ry={props.borderRadius ?? 5}
      width={props.width ?? 0}
      height={props.height ?? 0}
      style={style()}
      shape-rendering={props.shapeRendering}
    />
  );
};

export default MinimapNode;
