import clsx from "clsx";
import { mergeProps, type ParentProps, Show, splitProps } from "solid-js";

import type { BaseEdgeProps } from "@/types";

import { EdgeLabel } from "./EdgeLabel";

export const BaseEdge = (props: ParentProps<BaseEdgeProps>) => {
  const _props = mergeProps(
    {
      interactionWidth: 20,
    },
    props,
  );

  const [local, rest] = splitProps(_props, [
    "id",
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
  ]);

  return (
    <>
      <path
        id={local.id}
        d={local.path}
        class={clsx(["solid-flow__edge-path", local.class])}
        marker-start={local.markerStart}
        marker-end={local.markerEnd}
        fill="none"
        style={local.style}
      />

      <Show when={local.interactionWidth > 0}>
        <path
          d={local.path}
          stroke-opacity={0}
          stroke-width={local.interactionWidth}
          fill="none"
          class="solid-flow__edge-interaction"
          {...rest}
        />
      </Show>

      <Show when={local.label}>
        <EdgeLabel x={local.labelX} y={local.labelY} style={local.labelStyle}>
          {local.label}
        </EdgeLabel>
      </Show>
    </>
  );
};
