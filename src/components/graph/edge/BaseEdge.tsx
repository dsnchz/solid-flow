import clsx from "clsx";
import { type Component, Show } from "solid-js";

import type { EdgeProps } from "@/shared/types";

import EdgeLabel from "./EdgeLabel";

export type BaseEdgeProps = Pick<
  EdgeProps,
  "interactionWidth" | "label" | "labelStyle" | "style"
> & {
  readonly id?: string;
  /** SVG path of the edge */
  readonly path: string;
  /** The x coordinate of the label */
  readonly labelX?: number;
  /** The y coordinate of the label */
  readonly labelY?: number;
  /** Marker at start of edge
   * @example 'url(#arrow)'
   */
  readonly markerStart?: string;
  /** Marker at end of edge
   * @example 'url(#arrow)'
   */
  readonly markerEnd?: string;
  readonly class?: string;
};

const BaseEdge: Component<BaseEdgeProps> = (props) => {
  // In SolidJS, we use a getter function for computed values
  const interactionWidthValue = () =>
    props.interactionWidth === undefined ? 20 : props.interactionWidth;

  return (
    <>
      <path
        id={props.id}
        d={props.path}
        class={clsx(["solid-flow__edge-path", props.class])}
        marker-start={props.markerStart}
        marker-end={props.markerEnd}
        fill="none"
        style={props.style}
      />

      <Show when={interactionWidthValue()}>
        <path
          d={props.path}
          stroke-opacity={0}
          stroke-width={interactionWidthValue()}
          fill="none"
          class="solid-flow__edge-interaction"
        />
      </Show>

      <Show when={props.label}>
        <EdgeLabel x={props.labelX} y={props.labelY} style={props.labelStyle}>
          {props.label}
        </EdgeLabel>
      </Show>
    </>
  );
};

export default BaseEdge;
