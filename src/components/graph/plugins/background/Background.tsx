import clsx from "clsx";
import { type JSX, mergeProps, Show } from "solid-js";

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
  /** Style applied to the container */
  readonly style: JSX.CSSProperties;
};

const Background = (props: Partial<BackgroundProps>) => {
  const _props = mergeProps(
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
      style: {} as JSX.CSSProperties,
    },
    props,
  );

  const { store } = useFlowStore();

  const patternSize = () => _props.size || DEFAULT_SIZE[_props.variant];
  const isDots = () => _props.variant === "dots";
  const isCross = () => _props.variant === "cross";
  const gapXY = () =>
    Array.isArray(_props.gap) ? _props.gap : ([_props.gap, _props.gap] as [number, number]);

  const patternId = () => `background-pattern-${store.id}-${_props.id ? _props.id : ""}`;

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
      data-testid="solid-flow__background"
      class={clsx("solid-flow__container solid-flow__background", _props.class)}
      style={{
        ..._props.style,
        "--xy-background-color-props": _props.bgColor,
        "--xy-background-pattern-color-props": _props.patternColor,
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
          fallback={<DotPattern radius={scaledSize() / 2} class={_props.patternClass} />}
        >
          <LinePattern
            dimensions={patternDimensions()}
            lineWidth={_props.lineWidth}
            class={_props.patternClass}
          />
        </Show>
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId()})`} />
    </svg>
  );
};

export default Background;
