import { Handle, type NodeProps, ResizeControl } from "@/index";

import ResizeIcon from "./ResizeIcon";
import type { ResizerData } from "./types";

const controlStyle = {
  background: "transparent",
  border: "none",
};

export const CustomResizerNode = (props: NodeProps<Partial<ResizerData>>) => {
  return (
    <>
      <ResizeControl
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
      </ResizeControl>

      <Handle type="target" position="left" />
      <div>{props.data.label}</div>
      <Handle type="source" position="right" />
    </>
  );
};
