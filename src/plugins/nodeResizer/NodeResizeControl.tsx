import { isServer, type JSX } from "@solidjs/web";
import {
  type ControlPosition,
  XYResizer,
  type XYResizerChange,
  type XYResizerChildChange,
} from "@xyflow/system";
import { createEffect, createSignal, getOwner, type ParentProps, untrack } from "solid-js";

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
  const owner = getOwner();

  const [resizeControlRef, setResizeControlRef] = createSignal<HTMLDivElement>();
  const { store, nodeLookup, actions } = useInternalSolidFlow<NodeType>();

  const ctxNodeId = useNodeId();
  const nodeId = () => props.nodeId ?? ctxNodeId();
  const isLineVariant = () => variant() === "line";

  const controlPosition = () =>
    parts.position() ?? ((isLineVariant() ? "right" : "bottom-right") as ControlPosition);

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
      });

      setResizer(instance);
      return () => {
        instance.destroy();
      };
    },
  );

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
        onResizeStart: props.onResizeStart,
        onResize: props.onResize,
        onResizeEnd: props.onResizeEnd,
        shouldResize: props.shouldResize,
      },
    }),
    ({ instance, options }) => {
      instance?.update(options);
    },
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
  return (
    <>
      {isServer ? (
        <div {...extrasOf(props, extraKeys)} class={controlClass()} style={controlStyle()}>
          {parts.children()}
        </div>
      ) : (
        <div
          ref={(el) => {
            setResizeControlRef(el);
            spreadExtras(el, props, extraKeys, owner);
          }}
          class={controlClass()}
          style={controlStyle()}
        >
          {parts.children()}
        </div>
      )}
    </>
  );
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
