import { Handle, NodeResizeControl } from "@/components";
import type { NodeProps } from "@/types";

import type { ResizerData } from "./types";

export const HorizontalResizerNode = (props: NodeProps<Partial<ResizerData>>) => {
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
        color="red"
        position="left"
      />
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
        color="red"
        position="right"
      />
      <Handle type="target" position="top" />
      <div style={{ padding: "10px" }}>{props.data.label}</div>
      <Handle type="source" position="bottom" />
    </>
  );
};
