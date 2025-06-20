import { Show } from "solid-js";

import type { Edge, Node } from "@/types";

import { useInternalSolidFlow } from "../contexts";
import { ARIA_EDGE_DESC_KEY, ARIA_LIVE_MESSAGE, ARIA_NODE_DESC_KEY } from "./constants";

export const A11yDescriptions = <NodeType extends Node = Node, EdgeType extends Edge = Edge>() => {
  const { store } = useInternalSolidFlow<NodeType, EdgeType>();

  return (
    <>
      <div id={`${ARIA_NODE_DESC_KEY}-${store.id}`} class="a11y-hidden">
        {store.disableKeyboardA11y
          ? store.ariaLabelConfig["node.a11yDescription.default"]
          : store.ariaLabelConfig["node.a11yDescription.keyboardDisabled"]}
      </div>
      <div id={`${ARIA_EDGE_DESC_KEY}-${store.id}`} class="a11y-hidden">
        {store.ariaLabelConfig["edge.a11yDescription.default"]}
      </div>

      <Show when={!store.disableKeyboardA11y}>
        <div
          id={`${ARIA_LIVE_MESSAGE}-${store.id}`}
          aria-live="assertive"
          aria-atomic="true"
          class="a11y-live-msg"
        >
          {store.ariaLiveMessage}
        </div>
      </Show>
    </>
  );
};
