import {
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  type ShouldResize,
  XY_RESIZER_HANDLE_POSITIONS,
  XY_RESIZER_LINE_POSITIONS,
} from "@xyflow/system";
import { For, type JSX, mergeProps, Show, splitProps } from "solid-js";

import ResizeControl from "./ResizeControl";

export type NodeResizerProps = {
  /** Id of the node it is resizing
   * @remarks optional if used inside custom node
   */
  readonly nodeId?: string;
  /** Class applied to handle */
  readonly handleClass?: string;
  /** Style applied to handle */
  readonly handleStyle?: JSX.CSSProperties;
  /** Class applied to line */
  readonly lineClass?: string;
  /** Style applied to line */
  readonly lineStyle?: JSX.CSSProperties;
  /** Are the controls visible */
  readonly visible?: boolean;
  /** Minimum width of node */
  readonly minWidth?: number;
  /** Minimum height of node */
  readonly minHeight?: number;
  /** Maximum width of node */
  readonly maxWidth?: number;
  /** Maximum height of node */
  readonly maxHeight?: number;
  /** Keep aspect ratio when resizing */
  readonly keepAspectRatio?: boolean;
  /** Automatically scale the node when resizing */
  readonly autoScale?: boolean;
  /** Callback to determine if node should resize */
  readonly shouldResize?: ShouldResize;
  /** Callback called when resizing starts */
  readonly onResizeStart?: OnResizeStart;
  /** Callback called when resizing */
  readonly onResize?: OnResize;
  /** Callback called when resizing ends */
  readonly onResizeEnd?: OnResizeEnd;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "onResize" | "style">;

const NodeResizer = (props: Partial<NodeResizerProps>) => {
  const _props = mergeProps(
    {
      autoScale: true,
      visible: true,
    },
    props,
  );

  const [local, rest] = splitProps(props, ["handleClass", "handleStyle", "lineClass", "lineStyle"]);

  return (
    <Show when={_props.visible}>
      <For each={XY_RESIZER_LINE_POSITIONS}>
        {(position) => (
          <ResizeControl
            variant="line"
            position={position}
            class={local.lineClass}
            style={local.lineStyle}
            {...rest}
          />
        )}
      </For>
      <For each={XY_RESIZER_HANDLE_POSITIONS}>
        {(position) => (
          <ResizeControl
            position={position}
            class={local.handleClass}
            style={local.handleStyle}
            {...rest}
          />
        )}
      </For>
    </Show>
  );
};

export default NodeResizer;
