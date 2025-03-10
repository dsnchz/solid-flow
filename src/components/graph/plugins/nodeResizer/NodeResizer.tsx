import {
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  type ShouldResize,
  XY_RESIZER_HANDLE_POSITIONS,
  XY_RESIZER_LINE_POSITIONS,
} from "@xyflow/system";
import { For, mergeProps, Show } from "solid-js";

import ResizeControl from "./ResizeControl";

export type NodeResizerProps = {
  /** Id of the node it is resizing
   * @remarks optional if used inside custom node
   */
  readonly nodeId: string;
  /** Color of the resize handle */
  readonly color: string;
  /** Class applied to handle */
  readonly handleClass: string;
  /** Style applied to handle */
  readonly handleStyle: string;
  /** Class applied to line */
  readonly lineClass: string;
  /** Style applied to line */
  readonly lineStyle: string;
  /** Are the controls visible */
  readonly visible: boolean;
  /** Minimum width of node */
  readonly minWidth: number;
  /** Minimum height of node */
  readonly minHeight: number;
  /** Maximum width of node */
  readonly maxWidth: number;
  /** Maximum height of node */
  readonly maxHeight: number;
  /** Keep aspect ratio when resizing */
  readonly keepAspectRatio: boolean;
  /** Callback to determine if node should resize */
  readonly shouldResize: ShouldResize;
  /** Callback called when resizing starts */
  readonly onResizeStart: OnResizeStart;
  /** Callback called when resizing */
  readonly onResize: OnResize;
  /** Callback called when resizing ends */
  readonly onResizeEnd: OnResizeEnd;
};

const NodeResizer = (props: Partial<NodeResizerProps>) => {
  const _props = mergeProps(
    {
      minWidth: 10,
      maxWidth: Number.MAX_VALUE,
      minHeight: 10,
      maxHeight: Number.MAX_VALUE,
      visible: true,
    },
    props,
  );

  return (
    <Show when={_props.visible}>
      <For each={XY_RESIZER_LINE_POSITIONS}>
        {(position) => (
          <ResizeControl
            variant="line"
            position={position}
            class={_props.lineClass}
            style={_props.lineStyle}
            nodeId={_props.nodeId}
            color={_props.color}
            minWidth={_props.minWidth}
            maxWidth={_props.maxWidth}
            minHeight={_props.minHeight}
            maxHeight={_props.maxHeight}
            onResizeStart={_props.onResizeStart}
            keepAspectRatio={_props.keepAspectRatio}
            shouldResize={_props.shouldResize}
            onResize={_props.onResize}
            onResizeEnd={_props.onResizeEnd}
          />
        )}
      </For>
      <For each={XY_RESIZER_HANDLE_POSITIONS}>
        {(position) => (
          <ResizeControl
            position={position}
            class={_props.handleClass}
            style={_props.handleStyle}
            nodeId={_props.nodeId}
            color={_props.color}
            minWidth={_props.minWidth}
            minHeight={_props.minHeight}
            maxWidth={_props.maxWidth}
            maxHeight={_props.maxHeight}
            onResizeStart={_props.onResizeStart}
            keepAspectRatio={_props.keepAspectRatio}
            shouldResize={_props.shouldResize}
            onResize={_props.onResize}
            onResizeEnd={_props.onResizeEnd}
          />
        )}
      </For>
    </Show>
  );
};

export default NodeResizer;
