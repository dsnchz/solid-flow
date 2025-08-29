import { Handle, type NodeProps, NodeResizer } from "~/index";

import type { ResizerData } from "./types";

export const DefaultResizerNode = (props: NodeProps<ResizerData>) => {
  return (
    <>
      <NodeResizer
        minWidth={props.data?.minWidth}
        maxWidth={props.data?.maxWidth}
        minHeight={props.data?.minHeight}
        maxHeight={props.data?.maxHeight}
        visible={props.data?.visible ?? !!props.selected}
        shouldResize={props.data?.shouldResize}
        onResizeStart={props.data?.onResizeStart}
        onResize={props.data?.onResize}
        onResizeEnd={props.data?.onResizeEnd}
        keepAspectRatio={props.data?.keepAspectRatio}
      />
      <Handle type="target" position="left" />
      <div>{props.data?.label}</div>
      <Handle type="source" position="right" />
    </>
  );
};
