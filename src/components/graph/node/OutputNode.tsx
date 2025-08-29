import { mergeProps } from "solid-js";

import type { NodeProps, Position } from "../../../types";
import { Handle } from "../handle";

export const OutputNode = (props: NodeProps<{ label: string }>) => {
  const _props = mergeProps(
    {
      targetPosition: "top" as Position,
    },
    props,
  );

  return (
    <>
      <Handle type="target" position={_props.targetPosition} isConnectable={_props.isConnectable} />
      {props.data?.label}
    </>
  );
};
