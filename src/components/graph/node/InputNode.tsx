import { Position } from "@xyflow/system";
import { type Component } from "solid-js";

import { Handle } from "@/components/graph/handle";
import type { NodeProps } from "@/shared/types";

const InputNode: Component<NodeProps> = (props) => {
  return (
    <>
      {props.data?.label}
      <Handle
        type="source"
        position={props.sourcePosition ?? Position.Bottom}
        isConnectable={props.isConnectable}
      />
    </>
  );
};

export default InputNode;
