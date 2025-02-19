import type { ParentComponent } from "solid-js";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";

import { useFlowStore } from "@/components/contexts";

const ViewportPortal: ParentComponent = (props) => {
  const { store } = useFlowStore();

  return (
    <Show when={store.domNode}>
      {(domNode) => (
        <Portal mount={domNode().querySelector(".solid-flow__viewport-portal") ?? undefined}>
          {props.children}
        </Portal>
      )}
    </Show>
  );
};

export default ViewportPortal;
