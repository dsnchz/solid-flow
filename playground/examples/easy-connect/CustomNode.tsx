import { Show } from "solid-js";

import { Handle, type NodeProps, useConnection } from "@/index";

export default function CustomNode(props: NodeProps<Record<string, never>, "custom">) {
  const connection = useConnection();
  const isTarget = () => connection().inProgress && connection().fromNode?.id !== props.id;
  const label = () => (isTarget() ? "Drop here" : "Drag to connect");

  return (
    <div class="customNode">
      <div
        class="customNodeBody"
        style={{
          "border-style": isTarget() ? "dashed" : "solid",
          "background-color": isTarget() ? "#ffcce3" : "#ccd9f6",
        }}
      >
        {/* If handles are conditionally rendered and not present initially, you need to update the node internals */}
        {/* In this case we don't need to use useUpdateNodeInternals, since !isConnecting is true at the beginning and all handles are rendered initially. */}
        <Show when={!connection().inProgress}>
          <Handle class="customHandle" position="right" type="source" />
        </Show>
        {/* We want to disable the target handle, if the connection was started from this node */}
        <Show when={!connection().inProgress || isTarget()}>
          <Handle class="customHandle" position="left" type="target" isConnectableStart={false} />
        </Show>
        {label()}
      </div>
    </div>
  );
}
