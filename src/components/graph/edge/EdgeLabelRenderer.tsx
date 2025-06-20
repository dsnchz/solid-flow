import { type ParentProps, Show } from "solid-js";
import { Portal } from "solid-js/web";

import { useInternalSolidFlow } from "@/components/contexts";

export const EdgeLabelRenderer = (props: ParentProps) => {
  const { store } = useInternalSolidFlow();

  const labelNode = () => store.domNode?.querySelector(".solid-flow__edge-labels");

  return (
    <Show when={labelNode()}>{(root) => <Portal mount={root()}>{props.children}</Portal>}</Show>
  );
};
