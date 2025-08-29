import { Handle, type NodeProps, ResizeControl } from "@/index";

import type { ResizerData } from "./types";

export const HorizontalResizerNode = (props: NodeProps<Partial<ResizerData>>) => {
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
        color="red"
        position="left"
      />
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
        color="red"
        position="right"
      />
      <Handle type="target" position="top" />
      <div style={{ padding: "10px" }}>{props.data.label}</div>
      <Handle type="source" position="bottom" />
    </>
  );
};
