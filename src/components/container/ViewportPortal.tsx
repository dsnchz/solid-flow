import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { omit, type ParentProps, Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";

export type ViewportPortalProps = ParentProps<
  {
    /** In front of the nodes (default) or behind the edges. */
    readonly target?: "front" | "back";
  } & JSX.HTMLAttributes<HTMLDivElement>
>;

/**
 * Portals children into graph coordinate space so they pan and zoom with the
 * viewport: in front of the nodes, or behind the edges with `target="back"`
 * (Svelte Flow's ViewportPortal). Other attributes go on the wrapper div.
 */
export const ViewportPortal = (props: ViewportPortalProps): JSX.Element => {
  const { store } = useInternalSolidFlow();
  const rest = omit(props, "target", "children");

  return (
    <Show when={store.domNode}>
      {(domNode) => (
        <Portal
          mount={
            domNode().querySelector(`.solid-flow__viewport-${props.target ?? "front"}`) ?? undefined
          }
        >
          <div {...rest}>{props.children}</div>
        </Portal>
      )}
    </Show>
  );
};
