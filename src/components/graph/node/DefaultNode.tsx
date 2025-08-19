import { mergeProps } from "solid-js";

import { Handle } from "@/components/graph/handle";
import type { NodeProps, Position } from "@/types";

const DefaultNode = (props: NodeProps<{ label: string }, "default">) => {
  const _props = mergeProps(
    {
      targetPosition: "top" as Position,
      sourcePosition: "bottom" as Position,
    },
    props,
  );

  return (
    <>
      <Handle type="target" position={_props.targetPosition} isConnectable={_props.isConnectable} />
      {props.data.label}
      <Handle type="source" position={_props.sourcePosition} isConnectable={_props.isConnectable} />
    </>
  );
};

export default DefaultNode;
