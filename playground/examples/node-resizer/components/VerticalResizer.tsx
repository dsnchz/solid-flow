import { Handle, type NodeProps, ResizeControl } from "~/index";

import type { ResizerData } from "./types";

export const VerticalResizerNode = (props: NodeProps<Partial<ResizerData>>) => {
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
        position="top"
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
        position="bottom"
      />
      <Handle type="target" position="left" />
      <div style={{ padding: "10px" }}>{props.data.label}</div>
      <Handle type="source" position="right" />
    </>
  );
};
