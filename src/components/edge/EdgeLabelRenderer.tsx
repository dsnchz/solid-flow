import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { type ParentProps, Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";

// The label layer per flow root, found once instead of a querySelector per
// label (every labelled edge mounts one): a miss is not cached, so a layer
// that renders later is still found.
const labelLayers = new WeakMap<Element, Element>();
export const labelLayerOf = (domNode: Element): Element | undefined => {
  let layer = labelLayers.get(domNode);
  if (layer === undefined || !layer.isConnected) {
    layer = domNode.querySelector(".solid-flow__edge-labels") ?? undefined;
    if (layer) labelLayers.set(domNode, layer);
  }
  return layer;
};

/** Portals edge labels into a shared HTML layer rendered above the edge SVG. */
export const EdgeLabelRenderer = (props: ParentProps): JSX.Element => {
  const { store } = useInternalSolidFlow();

  const labelNode = () => {
    const domNode = store.domNode;
    return domNode ? labelLayerOf(domNode) : undefined;
  };

  return (
    <Show when={labelNode()}>{(root) => <Portal mount={root()}>{props.children}</Portal>}</Show>
  );
};
