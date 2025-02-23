import clsx from "clsx";
import type { JSX, ParentComponent } from "solid-js";

export type ControlButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  readonly class: string;
  readonly bgColor: string;
  readonly bgColorHover: string;
  readonly color: string;
  readonly colorHover: string;
  readonly borderColor: string;
  readonly onClick: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
};

const ControlButton: ParentComponent<Partial<ControlButtonProps>> = (props) => {
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
      onClick={(e) => props.onClick?.(e)}
      class={clsx("solid-flow__controls-button", props.class)}
      style={style()}
      {...props}
    >
      {props.children}
    </button>
  );
};

export default ControlButton;
