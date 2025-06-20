import { Position } from "@xyflow/system";
import clsx from "clsx";
import { type JSX, mergeProps } from "solid-js";

export type EdgeAnchorProps = {
  readonly type: string;
  readonly position: Position;
  readonly centerX: number;
  readonly centerY: number;
  readonly radius?: number;
  readonly onMouseDown: JSX.EventHandler<SVGCircleElement, MouseEvent>;
  readonly onMouseEnter: JSX.EventHandler<SVGCircleElement, MouseEvent>;
  readonly onMouseOut: JSX.EventHandler<SVGCircleElement, MouseEvent>;
};

export const EdgeAnchor = (props: EdgeAnchorProps) => {
  const _props = mergeProps({ radius: 10 }, props);

  const shiftX = (x: number, shift: number, position: Position): number => {
    if (position === Position.Left) return x - shift;
    if (position === Position.Right) return x + shift;
    return x;
  };

  const shiftY = (y: number, shift: number, position: Position): number => {
    if (position === Position.Top) return y - shift;
    if (position === Position.Bottom) return y + shift;
    return y;
  };

  return (
    <circle
      class={clsx("solid-flow__edgeupdater", _props.type)}
      stroke="transparent"
      fill="transparent"
      cx={shiftX(_props.centerX, _props.radius, _props.position)}
      cy={shiftY(_props.centerY, _props.radius, _props.position)}
      r={_props.radius}
      onMouseDown={(e) => _props.onMouseDown?.(e)}
      onMouseEnter={(e) => _props.onMouseEnter?.(e)}
      onMouseOut={(e) => _props.onMouseOut?.(e)}
    />
  );
};
