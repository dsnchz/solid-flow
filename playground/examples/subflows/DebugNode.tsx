import { Position } from "@xyflow/system";

import { Handle } from "@/components";
import type { NodeProps } from "@/types";

export const DebugNode = (props: NodeProps) => {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div>{props.id}</div>
      <div>
        x:{Math.round(props.positionAbsoluteX || 0)} y:{Math.round(props.positionAbsoluteY || 0)} z:
        {props.zIndex || 0}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
};
