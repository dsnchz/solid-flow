import { Handle, NodeResizeControl } from "@/components";
import type { NodeProps } from "@/types";

import ResizeIcon from "./ResizeIcon";
import type { ResizerData } from "./types";

const controlStyle = {
  background: "transparent",
  border: "none",
};

export const CustomResizerNode = (props: NodeProps<Partial<ResizerData>>) => {
  return (
    <>
      <NodeResizeControl
        minWidth={props.data.minWidth}
        maxWidth={props.data.maxWidth}
        minHeight={props.data.minHeight}
        maxHeight={props.data.maxHeight}
        shouldResize={props.data.shouldResize}
        onResizeStart={props.data.onResizeStart}
        onResize={props.data.onResize}
        onResizeEnd={props.data.onResizeEnd}
        keepAspectRatio={props.data.keepAspectRatio}
        style={controlStyle}
      >
        <ResizeIcon />
      </NodeResizeControl>

      <Handle type="target" position="left" />
      <div>{props.data.label}</div>
      <Handle type="source" position="right" />
    </>
  );
};
