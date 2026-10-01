import type { JSX } from "@solidjs/web";
import { getOwner, type ParentProps } from "solid-js";

import { useEdgeId, useInternalSolidFlow } from "@/contexts";
import { extraKeysOf, spreadExtras, toPxString } from "@/utils";

import { EdgeLabelRenderer } from "./EdgeLabelRenderer";

type EdgeLabelProps = {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly selectEdgeOnClick?: boolean;
  readonly transparent?: boolean;
  readonly style?: JSX.CSSProperties;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

/**
 * The props EdgeLabel consumes itself plus the attributes it sets on its
 * element (an extra prop never overrides them); every other key is an
 * attribute of the element.
 */
const OWN_KEYS: ReadonlySet<string> = new Set([
  "x",
  "y",
  "width",
  "height",
  "selectEdgeOnClick",
  "transparent",
  "children",
  "class",
  "style",
  "role",
  "tabindex",
  "onClick",
]);

/** Renders an edge label positioned in graph coordinates. */
export const EdgeLabel = (props: ParentProps<EdgeLabelProps>): JSX.Element => {
  // One label per labelled edge: the per-row rules (see Handle) instead of
  // propDefaults + omit + a JSX spread, which routed every attribute of the
  // element through one spread effect.
  const x = () => props.x ?? 0;
  const y = () => props.y ?? 0;
  const extraKeys = extraKeysOf(props, OWN_KEYS);
  const owner = getOwner();

  const { actions } = useInternalSolidFlow();

  const id = useEdgeId();

  const zIndex = () => actions.getLayoutedEdge(id())?.zIndex;

  return (
    <EdgeLabelRenderer>
      <div
        ref={(el) => spreadExtras(el, props, extraKeys, owner)}
        role="button"
        tabindex={-1}
        class={["solid-flow__edge-label", { transparent: props.transparent }, props.class]}
        style={{
          // No hideOnSSR needed (unlike Svelte Flow): EdgeLabelRenderer
          // portals into domNode, which only exists in the browser.
          "pointer-events": "all",
          width: toPxString(props.width),
          height: toPxString(props.height),
          transform: `translate(-50%, -50%) translate(${x()}px,${y()}px)`,
          cursor: props.selectEdgeOnClick ? "pointer" : undefined,
          "z-index": zIndex(),
          ...props.style,
        }}
        onClick={() => {
          if (props.selectEdgeOnClick) actions.handleEdgeSelection(id());
        }}
      >
        {props.children}
      </div>
    </EdgeLabelRenderer>
  );
};
