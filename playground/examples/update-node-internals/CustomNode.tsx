import { createSignal, For } from "solid-js";

import { Handle, type NodeProps, Position, useUpdateNodeInternals } from "~/index";

export const CustomNode = (props: NodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const [handleCount, setHandleCount] = createSignal(1);

  const onClick = () => {
    setHandleCount((prev) => prev + 1);
    updateNodeInternals(props.id);
  };

  return (
    <div
      style={{
        padding: "10px",
        border: "1px solid #777",
        background: "white",
        "border-radius": "5px",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <button onClick={onClick}>add handle</button>
      <For each={Array.from({ length: handleCount() }, (_, i) => i)}>
        {(i) => (
          <Handle
            type="source"
            position={Position.Bottom}
            id={i.toString()}
            style={{ left: `${i * 20 + 10}px` }}
          />
        )}
      </For>
    </div>
  );
};
