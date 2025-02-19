import { type Component, type JSX, Show } from "solid-js";
import { Portal } from "solid-js/web";

import { useFlowStore } from "@/components/contexts";

interface EdgeLabelRendererProps {
  children: JSX.Element;
}

const EdgeLabelRenderer: Component<EdgeLabelRendererProps> = (props) => {
  const { store } = useFlowStore();

  return (
    <Show when={store.domNode}>
      {(domNode) => (
        <Portal mount={domNode().querySelector(".solid-flow__edgelabel-renderer") ?? undefined}>
          {props.children}
        </Portal>
      )}
    </Show>
  );
};

export default EdgeLabelRenderer;
