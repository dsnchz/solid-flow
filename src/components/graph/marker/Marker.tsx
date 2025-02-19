import { MarkerType } from "@xyflow/system";
import { type Component, Show } from "solid-js";

type MarkerProps = {
  readonly id: string;
  readonly type: MarkerType;
  readonly width?: number;
  readonly height?: number;
  readonly markerUnits?: "strokeWidth" | "userSpaceOnUse";
  readonly orient?: string;
  readonly color?: string;
  readonly strokeWidth?: number;
};

const Marker: Component<MarkerProps> = (props) => {
  return (
    <marker
      class="solid-flow__arrowhead"
      id={props.id}
      markerWidth={`${props.width ?? 12.5}`}
      markerHeight={`${props.height ?? 12.5}`}
      viewBox="-10 -10 20 20"
      markerUnits={props.markerUnits ?? "strokeWidth"}
      orient={props.orient ?? "auto-start-reverse"}
      refX="0"
      refY="0"
    >
      <Show
        when={props.type === MarkerType.Arrow}
        fallback={
          <polyline
            stroke={props.color}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={props.strokeWidth}
            fill={props.color}
            points="-5,-4 0,0 -5,4 -5,-4"
          />
        }
      >
        <polyline
          stroke={props.color}
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width={props.strokeWidth}
          fill="none"
          points="-5,-4 0,0 -5,4"
        />
      </Show>
    </marker>
  );
};

export default Marker;
