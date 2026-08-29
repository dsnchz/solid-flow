import type { JSX } from "@solidjs/web";

import type { NodeProps } from "@/types";

import { Handle } from "../handle";

/** Built-in default node: label with source and target handles. */
export const DefaultNode = (props: NodeProps<{ label: string }, "default">): JSX.Element => (
  <>
    <Handle
      type="target"
      position={props.targetPosition ?? "top"}
      isConnectable={props.isConnectable}
    />
    {props.data.label}
    <Handle
      type="source"
      position={props.sourcePosition ?? "bottom"}
      isConnectable={props.isConnectable}
    />
  </>
);
