import { propDefaults } from "~/utils";

type DotPatternProps = {
  readonly class?: string;
  readonly radius?: number;
};

export const DotPattern = (props: DotPatternProps) => {
  const _props = propDefaults(props, { radius: 5 });

  return (
    <circle
      class={["solid-flow__background-pattern", "dots", _props.class]}
      cx={_props.radius}
      cy={_props.radius}
      r={_props.radius}
    />
  );
};
