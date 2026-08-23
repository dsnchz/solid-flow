import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { type ParentProps, Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";

/** Portals edge labels into a shared HTML layer rendered above the edge SVG. */
export const EdgeLabelRenderer = (props: ParentProps): JSX.Element => {
  const { store } = useInternalSolidFlow();

  const labelNode = () => store.domNode?.querySelector(".solid-flow__edge-labels");

  return (
    <Show when={labelNode()}>{(root) => <Portal mount={root()}>{props.children}</Portal>}</Show>
  );
};
