import { Position } from "@xyflow/system";
import { type Component } from "solid-js";

import { Handle } from "@/components/graph/handle";
import type { NodeProps } from "@/shared/types";

const OutputNode: Component<NodeProps> = (props) => {
  return (
    <>
      <Handle
        type="target"
        position={props.targetPosition ?? Position.Top}
        isConnectable={props.isConnectable}
      />
      {props.data?.label}
    </>
  );
};

export default OutputNode;
