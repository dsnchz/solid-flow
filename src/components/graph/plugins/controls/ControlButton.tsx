import type { JSX } from "@solidjs/web";
import { omit, type ParentProps } from "solid-js";

export type ControlButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  readonly class?: string;
  readonly bgColor?: string;
  readonly bgColorHover?: string;
  readonly color?: string;
  readonly colorHover?: string;
  readonly borderColor?: string;
  readonly onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
};

export const ControlButton = (props: ParentProps<ControlButtonProps>): JSX.Element => {
  const rest = omit(
    props,
    "class",
    "bgColor",
    "bgColorHover",
    "color",
    "colorHover",
    "borderColor",
    "onClick",
    "children",
  );

  const style = () =>
    Object.entries({
      "--xy-controls-button-background-color-props": props.bgColor,
      "--xy-controls-button-background-color-hover-props": props.bgColorHover,
      "--xy-controls-button-color-props": props.color,
      "--xy-controls-button-color-hover-props": props.colorHover,
      "--xy-controls-button-border-color-props": props.borderColor,
    })
      .filter(([_, value]) => value !== undefined)
      .reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value!;
        return acc;
      }, {});

  return (
    <button
      type="button"
      class={["solid-flow__controls-button", props.class]}
      onClick={(e) => props.onClick?.(e)}
      style={style()}
      {...rest}
    >
      {props.children}
    </button>
  );
};
