import type { JSX } from "@solidjs/web";

import { toPxString } from "@/components/internal/dom";
import type { NodeProps } from "@/types";

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
