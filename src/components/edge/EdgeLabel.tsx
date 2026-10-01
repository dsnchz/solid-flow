import { isServer, type JSX } from "@solidjs/web";
import { createRenderEffect, createRoot, getOwner, type ParentProps, runWithOwner } from "solid-js";

import { useEdgeId, useInternalSolidFlow } from "@/contexts";
import { clientOnlySetup, extraKeysOf, spreadExtras, toPxString } from "@/utils";

import { labelLayerOf } from "./EdgeLabelRenderer";

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

  const { store, actions } = useInternalSolidFlow();

  const id = useEdgeId();

  const zIndex = () => actions.getResolvedEdge(id())?.zIndex;

  const createLabel = (): HTMLDivElement | undefined => {
    let label: HTMLDivElement | undefined;
    void (
      <div
        ref={(el) => {
          label = el;
          spreadExtras(el, props, extraKeys, owner);
        }}
        role="button"
        tabindex={-1}
        class={["solid-flow__edge-label", { transparent: props.transparent }, props.class]}
        style={{
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
    );
    return label;
  };

  // Moved into the flow's label layer, as Svelte Flow's `use:portal` action
  // does (1.x and 2.0), instead of a Portal per label: a click bubbles
  // through the DOM there and does not reach the edge (`selectEdgeOnClick`
  // selects), and the label costs one effect and one root instead of the
  // Portal's owner, memo, render effect, root, insert, mount effect and
  // three text markers (bench round 64). Browser only (the layer is under
  // domNode); the effect stays outside the hydration id sequence.
  if (!isServer) {
    clientOnlySetup(() =>
      createRenderEffect(
        () => {
          const domNode = store.domNode;
          return domNode ? labelLayerOf(domNode) : undefined;
        },
        (layer) => {
          if (!layer) return;
          return runWithOwner(owner, () =>
            createRoot((dispose) => {
              const label = createLabel();
              if (label) layer.appendChild(label);
              return () => {
                dispose();
                label?.remove();
              };
            }),
          );
        },
      ),
    );
  }

  return null;
};
