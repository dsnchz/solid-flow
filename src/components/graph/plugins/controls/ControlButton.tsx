import clsx from "clsx";
import { type JSX, type ParentProps, splitProps } from "solid-js";

export type ControlButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  readonly class?: string;
  readonly bgColor?: string;
  readonly bgColorHover?: string;
  readonly color?: string;
  readonly colorHover?: string;
  readonly borderColor?: string;
  readonly onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
};

export const ControlButton = (props: ParentProps<ControlButtonProps>) => {
  const [local, rest] = splitProps(props, [
    "class",
    "bgColor",
    "bgColorHover",
    "color",
    "colorHover",
    "borderColor",
    "onClick",
    "children",
  ]);

  const style = () =>
    Object.entries({
      "--xy-controls-button-background-color-props": local.bgColor,
      "--xy-controls-button-background-color-hover-props": local.bgColorHover,
      "--xy-controls-button-color-props": local.color,
      "--xy-controls-button-color-hover-props": local.colorHover,
      "--xy-controls-button-border-color-props": local.borderColor,
    })
      .filter(([_, value]) => value !== undefined)
      .reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value!;
        return acc;
      }, {});

  return (
    <button
      type="button"
      class={clsx("solid-flow__controls-button", local.class)}
      onClick={(e) => local.onClick?.(e)}
      style={style()}
      {...rest}
    >
      {local.children}
    </button>
  );
};
