import { clsx } from "clsx";
import { mergeProps } from "solid-js";

type LinePatternProps = {
  readonly dimensions: [number, number];
  readonly lineWidth?: number;
  readonly class?: string;
};

const LinePattern = (props: LinePatternProps) => {
  const merged = mergeProps({ lineWidth: 1 }, props);

  return (
    <path
      class={clsx("solid-flow__background-pattern", "lines", merged.class)}
      stroke-width={merged.lineWidth}
      d={`M${merged.dimensions[0] / 2} 0 V${merged.dimensions[1]} M0 ${merged.dimensions[1] / 2} H${merged.dimensions[0]}`}
    />
  );
};

export default LinePattern;
