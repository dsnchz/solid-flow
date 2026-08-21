import { propDefaults } from "~/utils";

import type { BackgroundVariant } from ".";

type LinePatternProps = {
  readonly class?: string;
  readonly dimensions: [number, number];
  readonly lineWidth?: number;
  readonly variant: BackgroundVariant;
};

export const LinePattern = (props: LinePatternProps) => {
  const _props = propDefaults(props, { lineWidth: 1 });

  return (
    <path
      stroke-width={_props.lineWidth}
      d={`M${_props.dimensions[0] / 2} 0 V${_props.dimensions[1]} M0 ${_props.dimensions[1] / 2} H${_props.dimensions[0]}`}
      class={["solid-flow__background-pattern", _props.variant, _props.class]}
    />
  );
};
