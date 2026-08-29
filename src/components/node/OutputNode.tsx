import type { JSX } from "@solidjs/web";

import type { NodeProps } from "@/types";

import { Handle } from "../handle";

/** Built-in output node: label with a target handle only. */
export const OutputNode = (props: NodeProps<{ label: string }>): JSX.Element => (
  <>
    <Handle
      type="target"
      position={props.targetPosition ?? "top"}
      isConnectable={props.isConnectable}
    />
    {props.data?.label}
  </>
);
