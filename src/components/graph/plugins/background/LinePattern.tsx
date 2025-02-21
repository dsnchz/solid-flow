import { clsx } from "clsx";
import { type Component, mergeProps } from "solid-js";

import type { BackgroundVariant } from "./types";

type LinePatternProps = {
  readonly dimensions: [number, number];
  readonly lineWidth?: number;
  readonly variant?: BackgroundVariant;
  readonly class?: string;
};

const LinePattern: Component<LinePatternProps> = (props) => {
  const merged = mergeProps({ lineWidth: 1 }, props);

  return (
    <path
      stroke-width={merged.lineWidth}
      d={`M${merged.dimensions[0] / 2} 0 V${merged.dimensions[1]} M0 ${merged.dimensions[1] / 2} H${merged.dimensions[0]}`}
      class={clsx("solid-flow__background-pattern", merged.variant, merged.class)}
    />
  );
};

export default LinePattern;
