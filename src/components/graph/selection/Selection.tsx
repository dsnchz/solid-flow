import { mergeProps, Show } from "solid-js";

import { toPxString } from "~/utils";

type SelectionProps = {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly isVisible?: boolean;
};

export const Selection = (props: SelectionProps) => {
  const _props = mergeProps({ isVisible: true }, props);

  const styles = () => ({
    ...(_props.width != null && {
      width: typeof _props.width === "string" ? _props.width : toPxString(_props.width),
    }),
    ...(_props.height != null && {
      height: typeof _props.height === "string" ? _props.height : toPxString(_props.height),
    }),
    ...(_props.x != null &&
      _props.y != null && {
        transform: `translate(${props.x}px, ${props.y}px)`,
      }),
  });

  return (
    <Show when={_props.isVisible}>
      <div class="solid-flow__selection" style={styles()} />
    </Show>
  );
};
