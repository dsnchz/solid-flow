import type { MarkerProps as SystemMarkerProps } from "@xyflow/system";
import { type JSX, mergeProps, Show } from "solid-js";

export type MarkerProps = SystemMarkerProps & {
  readonly markerUnits?: "strokeWidth" | "userSpaceOnUse";
  // readonly color?: string;
  readonly strokeWidth?: number;
};

export const Marker = (props: MarkerProps) => {
  const _props = mergeProps(
    {
      markerUnits: "strokeWidth" as JSX.MarkerSVGAttributes<SVGElement>["markerUnits"],
      orient: "auto-start-reverse",
      width: 12.5,
      height: 12.5,
      color: "none",
    },
    props,
  );

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
            class="arrow"
            stroke={_props.color ?? "--xy-edge-stroke"}
            fill={_props.color ?? "yellow"}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={_props.strokeWidth}
            points="-5,-4 0,0 -5,4 -5,-4"
          />
        }
      >
        <polyline
          class="arrowclosed"
          stroke={_props.color ?? "--xy-edge-stroke"}
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
