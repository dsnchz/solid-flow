import { mergeProps } from "solid-js";

import { Handle } from "@/components/graph/handle";
import type { NodeProps, Position } from "@/types";

const InputNode = (props: NodeProps<{ label: string }>) => {
  const _props = mergeProps(
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

export default InputNode;
