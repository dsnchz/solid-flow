import { isServer, type JSX } from "@solidjs/web";
import { createRenderEffect, createRoot, getOwner, type ParentProps, runWithOwner } from "solid-js";

import { useEdgeId, useInternalSolidFlow } from "@/contexts";
import { edgeEndpointZ } from "@/core/projections/resolvedEdges";
import { clientOnlySetup, cx, extraKeysOf, spreadExtras, toPxString } from "@/utils";

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

/** What a label element shows; each part is read where the element binds it. */
export type EdgeLabelParts = {
  readonly x: () => number;
  readonly y: () => number;
  readonly width: () => number | undefined;
  readonly height: () => number | undefined;
  /** The whole class string, `solid-flow__edge-label` included. */
  readonly class: () => string;
  readonly style: () => JSX.CSSProperties | undefined;
  readonly selectEdgeOnClick: () => boolean;
  readonly children: () => JSX.Element;
  /** Bound once on the element (EdgeReconnectAnchor's gesture start). */
  readonly onPointerDown?: (event: PointerEvent) => void;
};

/**
 * One edge label element, moved into the flow's label layer. `props` is the
 * caller's props object and `extraKeys` its keys that become attributes of
 * the element: EdgeLabel's own, or EdgeReconnectAnchor's, which renders as
 * the label itself (as in Svelte Flow) instead of a label around a second
 * element. Call from a component body (it creates the label under the
 * caller's owner); it renders nothing in place.
 */
export const renderEdgeLabel = (
  props: object,
  extraKeys: readonly string[],
  parts: EdgeLabelParts,
): JSX.Element => {
  const owner = getOwner();

  const { store, actions, nodeLookup } = useInternalSolidFlow();

  const id = useEdgeId();

  // The drawn z: the edge row's own z plus its endpoints' (see edgeEndpointZ).
  const zIndex = () => {
    const edge = actions.getResolvedEdge(id());
    return (
      edge &&
      (edge.zIndex ?? 0) +
        edgeEndpointZ(edge, nodeLookup, store.elevateEdgesOnSelect, store.zIndexMode)
    );
  };

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
        class={parts.class()}
        style={{
          "pointer-events": "all",
          width: toPxString(parts.width()),
          height: toPxString(parts.height()),
          transform: `translate(-50%, -50%) translate(${parts.x()}px,${parts.y()}px)`,
          cursor: parts.selectEdgeOnClick() ? "pointer" : undefined,
          "z-index": zIndex(),
          ...parts.style(),
        }}
        onClick={() => {
          if (parts.selectEdgeOnClick()) actions.handleEdgeSelection(id());
        }}
        onPointerDown={parts.onPointerDown}
      >
        {parts.children()}
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

/** Renders an edge label positioned in graph coordinates. */
export const EdgeLabel = (props: ParentProps<EdgeLabelProps>): JSX.Element =>
  // One label per labelled edge: the per-row rules (see Handle) instead of
  // propDefaults + omit + a JSX spread, which routed every attribute of the
  // element through one spread effect.
  renderEdgeLabel(props, extraKeysOf(props, OWN_KEYS), {
    x: () => props.x ?? 0,
    y: () => props.y ?? 0,
    width: () => props.width,
    height: () => props.height,
    class: () => cx("solid-flow__edge-label", props.transparent && "transparent", props.class),
    style: () => props.style,
    selectEdgeOnClick: () => !!props.selectEdgeOnClick,
    children: () => props.children,
  });
