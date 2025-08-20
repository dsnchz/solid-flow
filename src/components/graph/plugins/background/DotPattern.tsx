import clsx from "clsx";
import { mergeProps } from "solid-js";

type DotPatternProps = {
  readonly class?: string;
  readonly radius?: number;
};

export const DotPattern = (props: DotPatternProps) => {
  const _props = mergeProps({ radius: 5 }, props);

  return (
    <circle
      class={clsx("solid-flow__background-pattern", "dots", _props.class)}
      cx={_props.radius}
      cy={_props.radius}
      r={_props.radius}
    />
  );
};
