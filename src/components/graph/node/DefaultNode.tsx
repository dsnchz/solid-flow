import { mergeProps } from "solid-js";

import type { NodeProps, Position } from "../../../types";
import { Handle } from "../handle";

export const DefaultNode = (props: NodeProps<{ label: string }, "default">) => {
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
