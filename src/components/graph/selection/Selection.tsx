import clsx from "clsx";
import { type Component, Show } from "solid-js";

interface SelectionProps {
  x: number | null;
  y: number | null;
  width: number | string | null;
  height: number | string | null;
  isVisible?: boolean;
}

const Selection: Component<Partial<SelectionProps>> = (props) => {
  const styles = () => ({
    ...(props.width != null && {
      width: typeof props.width === "string" ? props.width : `${props.width}px`,
    }),
    ...(props.height != null && {
      height: typeof props.height === "string" ? props.height : `${props.height}px`,
    }),
    ...(props.x != null &&
      props.y != null && {
        transform: `translate(${props.x}px, ${props.y}px)`,
      }),
  });

  return (
    <Show when={props.isVisible ?? true}>
      <div class={clsx("solid-flow__selection")} style={styles()} />
    </Show>
  );
};

export default Selection;
