import type { JSX } from "@solidjs/web";

import type { NodeProps } from "@/types";

import { Handle } from "../handle";

/** Built-in input node: label with a source handle only. */
export const InputNode = (props: NodeProps<{ label: string }>): JSX.Element => (
  <>
    {props.data?.label}
    <Handle
      type="source"
      position={props.sourcePosition ?? "bottom"}
      isConnectable={props.isConnectable}
    />
  </>
);
