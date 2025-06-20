import { mergeProps } from "solid-js";

import { Handle } from "@/components/graph/handle";
import type { Position } from "@/shared/types";
import type { NodeProps } from "@/types";

const OutputNode = (props: NodeProps<{ label: string }>) => {
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

export default OutputNode;
