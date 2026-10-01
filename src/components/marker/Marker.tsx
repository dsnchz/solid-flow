import type { JSX } from "@solidjs/web";
import type { MarkerProps as SystemMarkerProps } from "@xyflow/system";
import { Show } from "solid-js";

import { propDefaults } from "@/core/propDefaults";

export type MarkerProps = SystemMarkerProps & {
  readonly markerUnits?: "strokeWidth" | "userSpaceOnUse";
  // readonly color?: string;
  readonly strokeWidth?: number;
};

/** Internal SVG `<marker>` definition for one edge marker configuration. */
export const Marker = (props: MarkerProps): JSX.Element => {
  const _props = propDefaults(props, {
    markerUnits: "strokeWidth" as const,
    orient: "auto-start-reverse",
    width: 12.5,
    height: 12.5,
  });

  // An explicit color is inline style (it must beat the CSS rule); without
  // one (`color: null`, or `defaultMarkerColor={null}`) the marker takes the
  // edge stroke from `.solid-flow__arrowhead polyline` in the stylesheet.
  const color = () => _props.color ?? undefined;

  return (
    <marker
      class="solid-flow__arrowhead"
      id={_props.id}
      markerWidth={_props.width}
      markerHeight={_props.height}
      viewBox="-10 -10 20 20"
      markerUnits={_props.markerUnits}
      orient={_props.orient}
      refX="0"
      refY="0"
    >
      <Show
        when={_props.type === "arrow"}
        fallback={
          <polyline
            class="arrowclosed"
            style={{ stroke: color(), fill: color() }}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={_props.strokeWidth}
            points="-5,-4 0,0 -5,4 -5,-4"
          />
        }
      >
        <polyline
          class="arrow"
          style={{ stroke: color() }}
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width={_props.strokeWidth}
          points="-5,-4 0,0 -5,4"
        />
      </Show>
    </marker>
  );
};
