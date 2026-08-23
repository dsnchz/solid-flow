import type { JSX } from "@solidjs/web";

import type { NodeProps } from "@/types";
import { toPxString } from "@/utils";

/** Built-in group node: a plain container for child nodes. */
export const GroupNode = (props: NodeProps<Record<string, never>>): JSX.Element => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: toPxString(props.width),
      height: toPxString(props.height),
    }}
  />
);
