import { isServer, type JSX } from "@solidjs/web";
import {
  type ControlPosition,
  type NodeChange,
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  positionChange,
  type ShouldResize,
  XYResizer,
  type XYResizerChange,
  type XYResizerChildChange,
} from "@xyflow/system";
import { createEffect, createSignal, type ParentProps, untrack } from "solid-js";

import { cx, extraKeysOf, extrasOf, spreadExtras } from "@/components/internal/dom";
import { useInternalSolidFlow, useNodeId } from "@/contexts";
import type { Node, ResizeControlVariant } from "@/types";

import type { NodeResizerProps } from "./NodeResizer";

export type NodeResizerSubProps = Pick<
  NodeResizerProps,
  | "nodeId"
  | "minWidth"
  | "minHeight"
  | "maxWidth"
  | "maxHeight"
  | "autoScale"
  | "keepAspectRatio"
  | "shouldResize"
  | "onResizeStart"
  | "onResize"
  | "onResizeEnd"
>;

type ResizeControlProps = NodeResizerSubProps & {
  /** Position of control
   * @example "top-left" | "top-right" | "bottom-left" | "bottom-right"
   */
  readonly position?: ControlPosition;
  /** Variant of control
   * @example "handle", "line"
   */
  readonly variant?: ResizeControlVariant;
  readonly color?: string;
  readonly style?: JSX.CSSProperties;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "onResize" | "style">;

/**
 * The props a control consumes itself plus the attributes it sets on its
 * element (an extra prop never overrides them); every other key is an
 * attribute of the element.
 */
const OWN_KEYS: ReadonlySet<string> = new Set([
  "nodeId",
  "variant",
  "position",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "keepAspectRatio",
  "autoScale",
  "onResizeStart",
  "onResize",
  "onResizeEnd",
  "shouldResize",
  "class",
  "children",
  "color",
  "style",
]);

/** The parts of a control that differ per control of one NodeResizer. */
export type ResizeControlParts = {
  readonly variant: () => ResizeControlVariant;
  readonly position: () => ControlPosition | undefined;
  readonly class: () => JSX.ClassValue;
  readonly style: () => JSX.CSSProperties | undefined;
  readonly children: () => JSX.Element;
};

/**
 * One resize control. The resize options (nodeId, boundaries, callbacks,
 * color, autoScale) are read from `props`, a props object: a
 * NodeResizeControl's own props, or the NodeResizer's for each of its eight
 * controls, which then share that one object instead of a merged props
 * object each. `extraKeys` are its keys that become attributes of
 * the element. Called from a component body (it creates the control's
 * effects under the caller's owner).
 */
export const renderResizeControl = <NodeType extends Node = Node>(
  props: NodeResizerSubProps & { readonly color?: string },
  extraKeys: readonly string[],
  parts: ResizeControlParts,
): JSX.Element => {
  // Eight controls per NodeResizer: the per-row rules (see Handle) instead of
  // propDefaults + omit + a JSX spread, which routed every attribute of the
  // element through one spread effect.
  const variant = parts.variant;
  const minWidth = () => props.minWidth ?? 10;
  const minHeight = () => props.minHeight ?? 10;
  const maxWidth = () => props.maxWidth ?? Number.MAX_VALUE;
  const maxHeight = () => props.maxHeight ?? Number.MAX_VALUE;
  const autoScale = () => props.autoScale ?? true;

  const [resizeControlRef, setResizeControlRef] = createSignal<HTMLDivElement>();
  const { store, nodeLookup, actions, changes: flowChanges } = useInternalSolidFlow<NodeType>();

  const ctxNodeId = useNodeId();
  const nodeId = () => props.nodeId ?? ctxNodeId();
  const isLineVariant = () => variant() === "line";

  const controlPosition = () => parts.position() ?? (isLineVariant() ? "right" : "bottom-right");

  // Mount the resize controller on the control element (external system: XYResizer)
  const [resizer, setResizer] = createSignal<ReturnType<typeof XYResizer>>();

  createEffect(
    () => resizeControlRef(),
    (el) => {
      if (!el) return;

      const instance = XYResizer({
        domNode: el,
        // Read once, as Svelte Flow creates its XYResizer in onMount: a
        // deliberate setup read, untracked (STRICT_READ_UNTRACKED otherwise).
        nodeId: untrack(nodeId),
        getStoreItems: () => ({
          nodeLookup,
          transform: store.transform,
          snapGrid: store.snapGrid,
          snapToGrid: !!store.snapGrid,
          nodeOrigin: store.nodeOrigin,
          paneDomNode: store.domNode,
        }),
        onChange: (change: XYResizerChange, childChanges: XYResizerChildChange[]) => {
          // onNodesChange set: the resize as Svelte Flow 2 describes it.
          if (flowChanges.nodes.active()) {
            const id = nodeId();
            const list: NodeChange<NodeType>[] = [];
            if (change.x !== undefined && change.y !== undefined) {
              list.push(positionChange(id, { x: change.x, y: change.y }));
            }
            if (change.width !== undefined && change.height !== undefined) {
              list.push({
                id,
                type: "dimensions",
                resizing: true,
                setAttributes: true,
                dimensions: { width: change.width, height: change.height },
              });
            }
            for (const childChange of childChanges) {
              list.push(positionChange(childChange.id, childChange.position));
            }
            flowChanges.nodes.queue(list);
            return;
          }
          const changes = new Map<string, Partial<Node>>();
          const position =
            change.x !== undefined && change.y !== undefined
              ? { x: change.x, y: change.y }
              : undefined;
          changes.set(nodeId(), { ...change, position });

          for (const childChange of childChanges) {
            changes.set(childChange.id, {
              position: childChange.position,
            });
          }

          actions.setNodes((nodes) => {
            for (const node of nodes) {
              const nodeChange = changes.get(node.id);
              if (!nodeChange) continue;

              // Child changes carry only a position: keep their size.
              if (nodeChange.width !== undefined) node.width = nodeChange.width;
              if (nodeChange.height !== undefined) node.height = nodeChange.height;
              node.position = {
                x: nodeChange.position?.x ?? node.position.x,
                y: nodeChange.position?.y ?? node.position.y,
              };
            }
            return undefined;
          });
        },
        // The resize end clears `resizing`; only described with onNodesChange
        // set (the direct path never sets it).
        onEnd: ({ width, height }) => {
          if (!flowChanges.nodes.active()) return;
          flowChanges.nodes.queue([
            { id: nodeId(), type: "dimensions", resizing: false, dimensions: { width, height } },
          ]);
        },
      });

      setResizer(instance);
      return () => {
        instance.destroy();
      };
    },
    { name: "nodeResizeControl.resizer" },
  );

  // Stable handlers that call the latest props when XYResizer calls them: a
  // new handler then needs no update(), which rebinds the d3 drag listeners
  // and ends a touch resize in progress (xyflow#6127).
  const callbacks: {
    onResizeStart: OnResizeStart;
    onResize: OnResize;
    onResizeEnd: OnResizeEnd;
    shouldResize: ShouldResize;
  } = {
    onResizeStart: (event, params) => props.onResizeStart?.(event, params),
    onResize: (event, params) => props.onResize?.(event, params),
    onResizeEnd: (event, params) => props.onResizeEnd?.(event, params),
    // `=== false` is the only answer XYResizer acts on: unset means resize.
    shouldResize: (event, params) => props.shouldResize?.(event, params) ?? true,
  };

  createEffect(
    () => ({
      instance: resizer(),
      options: {
        controlPosition: controlPosition(),
        boundaries: {
          minWidth: minWidth(),
          minHeight: minHeight(),
          maxWidth: maxWidth(),
          maxHeight: maxHeight(),
        },
        keepAspectRatio: !!props.keepAspectRatio,
      },
    }),
    ({ instance, options }) => {
      instance?.update({ ...options, ...callbacks });
    },
    { name: "nodeResizeControl.options" },
  );

  const controlClass = () =>
    cx(
      "solid-flow__resize-control",
      variant(),
      store.noDragClass,
      controlPosition().replace("-", " "),
      parts.class(),
    );
  const controlStyle = (): JSX.CSSProperties => ({
    "border-color": isLineVariant() ? props.color : undefined,
    "background-color": isLineVariant() ? undefined : props.color,
    scale: isLineVariant() || !autoScale() ? undefined : Math.max(1 / store.viewport.zoom, 1),
    ...parts.style(),
  });

  // The server's copy of the element: a ref never runs in a server render,
  // so the extras are spread here (extrasOf). Same attributes as the client
  // element below, which the hydration lane checks.
  let element: HTMLDivElement | undefined;
  const view = isServer ? (
    <div {...extrasOf(props, extraKeys)} class={controlClass()} style={controlStyle()}>
      {parts.children()}
    </div>
  ) : (
    <div
      ref={(el) => {
        element = el;
        setResizeControlRef(el);
      }}
      class={controlClass()}
      style={controlStyle()}
    >
      {parts.children()}
    </div>
  );
  // From the body, not the ref (see spreadExtras); the ref has run by now.
  if (element) spreadExtras(element, props, extraKeys);
  return view;
};

/** A single resize handle or line — the building block of `NodeResizer`. */
export const NodeResizeControl = <NodeType extends Node = Node>(
  props: ParentProps<ResizeControlProps>,
): JSX.Element =>
  renderResizeControl<NodeType>(props, extraKeysOf(props, OWN_KEYS), {
    variant: () => props.variant ?? "handle",
    position: () => props.position,
    class: () => props.class,
    style: () => props.style,
    children: () => props.children,
  });
