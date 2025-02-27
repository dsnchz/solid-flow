import clsx from "clsx";
import { mergeProps } from "solid-js";

type DotPatternProps = {
  readonly radius: number;
  readonly class: string;
};

const DotPattern = (props: Partial<DotPatternProps>) => {
  const merged = mergeProps({ radius: 5 }, props);

  return (
    <circle
      class={clsx("solid-flow__background-pattern", "dots", merged.class)}
      cx={merged.radius}
      cy={merged.radius}
      r={merged.radius}
    />
  );
};

export default DotPattern;
