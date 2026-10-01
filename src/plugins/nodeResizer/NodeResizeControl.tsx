import type { JSX } from "@solidjs/web";
import {
  type ControlPosition,
  XYResizer,
  type XYResizerChange,
  type XYResizerChildChange,
} from "@xyflow/system";
import { createEffect, createSignal, omit, type ParentProps, untrack } from "solid-js";

import { useInternalSolidFlow, useNodeId } from "@/contexts";
import type { Node, ResizeControlVariant } from "@/types";
import { propDefaults } from "@/utils";

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

/** A single resize handle or line — the building block of `NodeResizer`. */
export const NodeResizeControl = <NodeType extends Node = Node>(
  props: ParentProps<ResizeControlProps>,
): JSX.Element => {
  const _props = propDefaults(props, {
    variant: "handle" as ResizeControlVariant,
    minWidth: 10,
    minHeight: 10,
    maxWidth: Number.MAX_VALUE,
    maxHeight: Number.MAX_VALUE,
    keepAspectRatio: false,
    autoScale: true,
    style: {} as JSX.CSSProperties,
  });

  const rest = omit(
    _props,
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
  );

  const [resizeControlRef, setResizeControlRef] = createSignal<HTMLDivElement>();
  const { store, nodeLookup, actions } = useInternalSolidFlow<NodeType>();

  const ctxNodeId = useNodeId();
  const nodeId = () => _props.nodeId ?? ctxNodeId();
  const isLineVariant = () => _props.variant === "line";

  const controlPosition = () =>
    _props.position ?? ((isLineVariant() ? "right" : "bottom-right") as ControlPosition);

  const positionClassNames = () => controlPosition().split("-");

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
          minWidth: _props.minWidth,
          minHeight: _props.minHeight,
          maxWidth: _props.maxWidth,
          maxHeight: _props.maxHeight,
        },
        keepAspectRatio: !!_props.keepAspectRatio,
        onResizeStart: _props.onResizeStart,
        onResize: _props.onResize,
        onResizeEnd: _props.onResizeEnd,
        shouldResize: _props.shouldResize,
      },
    }),
    ({ instance, options }) => {
      instance?.update(options);
    },
  );

  return (
    <div
      ref={setResizeControlRef}
      class={[
        "solid-flow__resize-control",
        _props.variant,
        store.noDragClass,
        ...positionClassNames(),
        _props.class,
      ]}
      style={{
        "border-color": isLineVariant() ? _props.color : undefined,
        "background-color": isLineVariant() ? undefined : _props.color,
        scale:
          isLineVariant() || !_props.autoScale ? undefined : Math.max(1 / store.viewport.zoom, 1),
        ..._props.style,
      }}
      {...rest}
    >
      {_props.children}
    </div>
  );
};
