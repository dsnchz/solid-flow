import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import type { ParentProps } from "solid-js";
import { Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";

export const ViewportPortal = (props: ParentProps): JSX.Element => {
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
