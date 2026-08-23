import type { JSX } from "@solidjs/web";
import { Position } from "@xyflow/system";

import type { NodeProps } from "@/types";
import { propDefaults } from "@/utils";

import { Handle } from "../handle";

/** Built-in input node: label with a source handle only. */
export const InputNode = (props: NodeProps<{ label: string }>): JSX.Element => {
  const _props = propDefaults(props, {
    sourcePosition: Position.Bottom,
  });

  return (
    <>
      {props.data?.label}
      <Handle type="source" position={_props.sourcePosition} isConnectable={_props.isConnectable} />
    </>
  );
};
