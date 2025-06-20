import type { ParentProps } from "solid-js";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";

import { useInternalSolidFlow } from "@/components/contexts";

export const ViewportPortal = (props: ParentProps) => {
  const { store } = useInternalSolidFlow();

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
