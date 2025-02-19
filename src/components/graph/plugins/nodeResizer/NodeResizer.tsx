import {
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  ResizeControlVariant,
  type ShouldResize,
  XY_RESIZER_HANDLE_POSITIONS,
  XY_RESIZER_LINE_POSITIONS,
} from "@xyflow/system";
import { type Component, For } from "solid-js";

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
  readonly isVisible: boolean;
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

const NodeResizer: Component<Partial<NodeResizerProps>> = (props) => {
  const getMinWidth = () => props.minWidth || 10;
  const getMinHeight = () => props.minHeight || 10;
  const getMaxWidth = () => props.maxWidth || Number.MAX_VALUE;
  const getMaxHeight = () => props.maxHeight || Number.MAX_VALUE;

  return (
    <>
      {props.isVisible !== false && (
        <>
          <For each={XY_RESIZER_LINE_POSITIONS}>
            {(position) => (
              <ResizeControl
                class={props.lineClass}
                style={props.lineStyle}
                nodeId={props.nodeId}
                position={position}
                variant={ResizeControlVariant.Line}
                color={props.color}
                minWidth={getMinWidth()}
                minHeight={getMinHeight()}
                maxWidth={getMaxWidth()}
                maxHeight={getMaxHeight()}
                onResizeStart={props.onResizeStart}
                keepAspectRatio={props.keepAspectRatio}
                shouldResize={props.shouldResize}
                onResize={props.onResize}
                onResizeEnd={props.onResizeEnd}
              />
            )}
          </For>
          <For each={XY_RESIZER_HANDLE_POSITIONS}>
            {(position) => (
              <ResizeControl
                class={props.handleClass}
                style={props.handleStyle}
                nodeId={props.nodeId}
                position={position}
                color={props.color}
                minWidth={getMinWidth()}
                minHeight={getMinHeight()}
                maxWidth={getMaxWidth()}
                maxHeight={getMaxHeight()}
                onResizeStart={props.onResizeStart}
                keepAspectRatio={props.keepAspectRatio}
                shouldResize={props.shouldResize}
                onResize={props.onResize}
                onResizeEnd={props.onResizeEnd}
              />
            )}
          </For>
        </>
      )}
    </>
  );
};

export default NodeResizer;
