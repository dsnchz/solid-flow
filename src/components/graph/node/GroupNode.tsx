import type { NodeProps } from "@/types";
import { toPxString } from "@/utils";

export const GroupNode = (props: NodeProps<Record<string, never>>) => (
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
