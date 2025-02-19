import { Position } from "@xyflow/system";
import { type Component } from "solid-js";

import { Handle } from "@/components/graph/handle";
import type { NodeProps } from "@/shared/types";

const DefaultNode: Component<NodeProps> = (props) => {
  return (
    <>
      <Handle
        type="target"
        position={props.targetPosition ?? Position.Top}
        isConnectable={props.isConnectable}
      />
      {props.data?.label}
      <Handle
        type="source"
        position={props.sourcePosition ?? Position.Bottom}
        isConnectable={props.isConnectable}
      />
    </>
  );
};

export default DefaultNode;
