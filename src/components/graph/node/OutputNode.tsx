import type { JSX } from "@solidjs/web";
import { merge } from "solid-js";

import type { NodeProps, Position } from "../../../types";
import { Handle } from "../handle";

export const OutputNode = (props: NodeProps<{ label: string }>): JSX.Element => {
  const _props = merge(
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
