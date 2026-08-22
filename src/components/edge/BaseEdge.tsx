import type { JSX } from "@solidjs/web";
import { omit, type ParentProps, Show } from "solid-js";

import type { BaseEdgeProps } from "@/types";
import { propDefaults } from "@/utils";

import { EdgeLabel } from "./EdgeLabel";

export const BaseEdge = (props: ParentProps<BaseEdgeProps>): JSX.Element => {
  const _props = propDefaults(props, {
    interactionWidth: 20,
  });

  const rest = omit(
    _props,
    "class",
    "style",
    "path",
    "interactionWidth",
    "label",
    "labelStyle",
    "labelX",
    "labelY",
    "markerStart",
    "markerEnd",
  );

  return (
    <>
      <path
        d={_props.path}
        class={["solid-flow__edge-path", _props.class]}
        marker-start={_props.markerStart}
        marker-end={_props.markerEnd}
        fill="none"
        style={_props.style}
        {...rest}
      />

      <Show when={_props.interactionWidth > 0}>
        <path
          d={_props.path}
          stroke-opacity={0}
          stroke-width={_props.interactionWidth}
          fill="none"
          class="solid-flow__edge-interaction"
        />
      </Show>

      <Show when={_props.label}>
        <EdgeLabel x={_props.labelX} y={_props.labelY} style={_props.labelStyle}>
          {_props.label}
        </EdgeLabel>
      </Show>
    </>
  );
};
