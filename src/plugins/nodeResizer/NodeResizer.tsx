import type { JSX } from "@solidjs/web";
import {
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  type ShouldResize,
  XY_RESIZER_HANDLE_POSITIONS,
  XY_RESIZER_LINE_POSITIONS,
} from "@xyflow/system";
import { For, omit, Show } from "solid-js";

import { propDefaults } from "@/utils";

import { ResizeControl } from "./ResizeControl";

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

/** Resize handles and lines around a node; place inside a custom node to make it resizable. */
export const NodeResizer = (props: Partial<NodeResizerProps>): JSX.Element => {
  const _props = propDefaults(props, {
    autoScale: true,
    visible: true,
  });

  const rest = omit(props, "handleClass", "handleStyle", "lineClass", "lineStyle");

  return (
    <Show when={_props.visible}>
      <For each={XY_RESIZER_LINE_POSITIONS}>
        {(position) => (
          <ResizeControl
            variant="line"
            position={position}
            class={props.lineClass}
            style={props.lineStyle}
            {...rest}
          />
        )}
      </For>
      <For each={XY_RESIZER_HANDLE_POSITIONS}>
        {(position) => (
          <ResizeControl
            position={position}
            class={props.handleClass}
            style={props.handleStyle}
            {...rest}
          />
        )}
      </For>
    </Show>
  );
};
