import { type Component, mergeProps } from "solid-js";

type DotPatternProps = {
  readonly radius: number;
  readonly class: string;
};

const DotPattern: Component<Partial<DotPatternProps>> = (props) => {
  const merged = mergeProps({ radius: 5 }, props);

  return (
    <circle
      cx={merged.radius}
      cy={merged.radius}
      r={merged.radius}
      class={["solid-flow__background-pattern", "dots", merged.class].filter(Boolean).join(" ")}
    />
  );
};

export default DotPattern;
