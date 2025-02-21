import type { Component, JSX } from "solid-js";

import type { NodeProps } from "@/shared/types";

export type GroupNodeProps = Omit<NodeProps, "width" | "height"> & {
  readonly width?: JSX.CSSProperties["width"];
  readonly height?: JSX.CSSProperties["height"];
};

const GroupNode: Component<GroupNodeProps> = (props) => (
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
