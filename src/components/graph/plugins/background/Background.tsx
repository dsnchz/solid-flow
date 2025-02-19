import { mergeProps, type ParentComponent, Show } from "solid-js";

import { useFlowStore } from "@/components/contexts";

import DotPattern from "./DotPattern";
import LinePattern from "./LinePattern";
import type { BackgroundVariant } from "./types";

const DEFAULT_SIZE: Record<BackgroundVariant, number> = {
  dots: 1,
  lines: 1,
  cross: 6,
};

type BackgroundProps = {
  readonly id: string;
  /** Variant of the pattern
   * @example BackgroundVariant.Lines, BackgroundVariant.Dots, BackgroundVariant.Cross
   * 'lines', 'dots', 'cross'
   */
  readonly variant: BackgroundVariant;
  /** Color of the background */
  readonly bgColor: string;
  /** Color of the pattern */
  readonly patternColor: string;
  /** Class applied to the pattern */
  readonly patternClass: string;
  /** Class applied to the container */
  readonly class: string;
  /** Gap between repetitions of the pattern */
  readonly gap: number | [number, number];
  /** Size of a single pattern element */
  readonly size: number;
  /** Line width of the Line pattern */
  readonly lineWidth: number;
};

const Background: ParentComponent<Partial<BackgroundProps>> = (props) => {
  const merged = mergeProps(
    {
      id: undefined,
      variant: "dots" as BackgroundVariant,
      gap: 20,
      size: 1,
      lineWidth: 1,
      bgColor: undefined,
      patternColor: undefined,
      patternClass: undefined,
      class: "",
    },
    props,
  );

  const { store } = useFlowStore();

  const patternSize = () => merged.size || DEFAULT_SIZE[merged.variant];
  const isDots = () => merged.variant === "dots";
  const isCross = () => merged.variant === "cross";
  const gapXY = () =>
    Array.isArray(merged.gap) ? merged.gap : ([merged.gap, merged.gap] as [number, number]);

  const patternId = () => `background-pattern-${store.id}-${merged.id ? merged.id : ""}`;

  const scaledGap = () =>
    [gapXY()[0] * store.viewport.zoom || 1, gapXY()[1] * store.viewport.zoom || 1] as [
      number,
      number,
    ];

  const scaledSize = () => patternSize() * store.viewport.zoom;

  const patternDimensions = () =>
    isCross() ? ([scaledSize(), scaledSize()] as [number, number]) : scaledGap();

  const patternOffset = () =>
    isDots()
      ? [scaledSize() / 2, scaledSize() / 2]
      : [patternDimensions()[0] / 2, patternDimensions()[1] / 2];

  return (
    <svg
      class={["solid-flow__background", merged.class].filter(Boolean).join(" ")}
      data-testid="solid-flow__background"
      style={{
        "--xy-background-color-props": merged.bgColor,
        "--xy-background-pattern-color-props": merged.patternColor,
      }}
    >
      <pattern
        id={patternId()}
        x={store.viewport.x % scaledGap()[0]}
        y={store.viewport.y % scaledGap()[1]}
        width={scaledGap()[0]}
        height={scaledGap()[1]}
        patternUnits="userSpaceOnUse"
        patternTransform={`translate(-${patternOffset()[0]},-${patternOffset()[1]})`}
      >
        <Show
          when={!isDots()}
          fallback={<DotPattern radius={scaledSize() / 2} class={merged.patternClass} />}
        >
          <LinePattern
            dimensions={patternDimensions()}
            variant={merged.variant}
            lineWidth={merged.lineWidth}
            class={merged.patternClass}
          />
        </Show>
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId()})`} />
    </svg>
  );
};

export default Background;
