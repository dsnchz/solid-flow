import type { JSX } from "@solidjs/web";
import { merge } from "solid-js";

import type { NodeProps, Position } from "../../../types";
import { Handle } from "../handle";

export const InputNode = (props: NodeProps<{ label: string }>): JSX.Element => {
  const _props = merge(
    {
      sourcePosition: "bottom" as Position,
    },
    props,
  );

  return (
    <>
      {props.data?.label}
      <Handle type="source" position={_props.sourcePosition} isConnectable={_props.isConnectable} />
    </>
  );
};
