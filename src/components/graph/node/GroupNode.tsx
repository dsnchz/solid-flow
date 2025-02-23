import type { Component } from "solid-js";

import type { NodeProps } from "@/shared/types";

const GroupNode: Component<NodeProps> = (props) => (
  <div
    style={{
      width: props.width,
      height: props.height,
      position: "absolute",
      left: 0,
      top: 0,
    }}
  />
);

export default GroupNode;
