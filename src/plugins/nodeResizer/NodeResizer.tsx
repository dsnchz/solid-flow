import type { JSX } from "@solidjs/web";
import {
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  type ShouldResize,
  XY_RESIZER_HANDLE_POSITIONS,
  XY_RESIZER_LINE_POSITIONS,
} from "@xyflow/system";
import { Show } from "solid-js";

import { extraKeysOf } from "@/utils";

import { renderResizeControl } from "./NodeResizeControl";

export type NodeResizerProps = {
  /** Id of the node it is resizing
   * @remarks optional if used inside custom node
   */
  readonly nodeId?: string;
  /** Color of the resize handle */
  readonly color?: string;
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

/**
 * NodeResizer's own props plus the resize options its controls read from it
 * and the control props it decides per control; every other key is an
 * attribute of each control element.
 */
const OWN_KEYS: ReadonlySet<string> = new Set([
  "nodeId",
  "color",
  "handleClass",
  "handleStyle",
  "lineClass",
  "lineStyle",
  "visible",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "keepAspectRatio",
  "autoScale",
  "shouldResize",
  "onResizeStart",
  "onResize",
  "onResizeEnd",
  "class",
  "style",
  "children",
]);

/** Resize handles and lines around a node; place inside a custom node to make it resizable. */
export const NodeResizer = (props: Partial<NodeResizerProps>): JSX.Element => {
  // Eight controls per resizable node read the resize options from THIS props
  // object (one reference, no merged props object per control) and take
  // their extra attributes from the keys found once here.
  const extraKeys = extraKeysOf(props, OWN_KEYS);
  // A `class` given to the NodeResizer wins over lineClass/handleClass, as the
  // forwarded props did (Svelte Flow spreads them after the same way).
  const lineClass = () => ("class" in props ? props.class : props.lineClass);
  const handleClass = () => ("class" in props ? props.class : props.handleClass);
  const children = () => props.children;

  // The four lines and four handles, created while visible (inside Show);
  // the position lists are constants, so nothing here is ever re-mapped.
  const controls = () => [
    ...XY_RESIZER_LINE_POSITIONS.map((position) =>
      renderResizeControl(props, extraKeys, {
        variant: () => "line",
        position: () => position,
        class: lineClass,
        style: () => props.lineStyle,
        children,
      }),
    ),
    ...XY_RESIZER_HANDLE_POSITIONS.map((position) =>
      renderResizeControl(props, extraKeys, {
        variant: () => "handle",
        position: () => position,
        class: handleClass,
        style: () => props.handleStyle,
        children,
      }),
    ),
  ];

  return <Show when={props.visible ?? true}>{controls()}</Show>;
};
