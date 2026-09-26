import type { JSX } from "@solidjs/web";
import { getOwner, type ParentProps, Show } from "solid-js";

import type { BaseEdgeProps } from "@/types";
import { cx, extraKeysOf, spreadExtras } from "@/utils";

import { EdgeLabel } from "./EdgeLabel";

/** The props BaseEdge consumes itself; every other key is an attribute of the path. */
const OWN_KEYS: ReadonlySet<string> = new Set([
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
  "children",
]);

const DEFAULT_INTERACTION_WIDTH = 20;

/**
 * Lowest-level edge primitive: renders the SVG path, label, and interaction width.
 *
 * Extra props reach the path as attributes and stay reactive. Which keys are
 * extra is read once, from the keys present when the edge mounts (a JSX
 * props object has a fixed key set); the built-in edge types pass none, and
 * for them no attribute spread is installed at all — the spread is a render
 * effect that re-enumerates its source on every run (bench round 35).
 */
export const BaseEdge = (props: ParentProps<BaseEdgeProps>): JSX.Element => {
  // Skip-undefined default (see propDefaults) without building a getter object per edge.
  const interactionWidth = () => props.interactionWidth ?? DEFAULT_INTERACTION_WIDTH;

  const extraKeys = extraKeysOf(props, OWN_KEYS);
  const owner = getOwner();
  const mountPath = (el: SVGPathElement) => spreadExtras(el, props, extraKeys, owner);

  return (
    <>
      <path
        ref={mountPath}
        id={props.id}
        d={props.path}
        class={cx("solid-flow__edge-path", props.class)}
        marker-start={props.markerStart}
        marker-end={props.markerEnd}
        fill="none"
        style={props.style}
      />

      <Show when={interactionWidth() > 0}>
        <path
          d={props.path}
          stroke-opacity={0}
          stroke-width={interactionWidth()}
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
