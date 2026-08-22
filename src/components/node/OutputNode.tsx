import type { JSX } from "@solidjs/web";
import { Position } from "@xyflow/system";

import type { NodeProps } from "@/types";
import { propDefaults } from "@/utils";

import { Handle } from "../handle";

export const OutputNode = (props: NodeProps<{ label: string }>): JSX.Element => {
  const _props = propDefaults(props, {
    targetPosition: Position.Top,
  });

  return (
    <>
      <Handle type="target" position={_props.targetPosition} isConnectable={_props.isConnectable} />
      {props.data?.label}
    </>
  );
};
