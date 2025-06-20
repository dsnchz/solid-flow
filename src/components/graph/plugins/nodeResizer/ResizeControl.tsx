import {
  type ControlPosition,
  XYResizer,
  type XYResizerChange,
  type XYResizerChildChange,
} from "@xyflow/system";
import clsx from "clsx";
import {
  createEffect,
  type JSX,
  mergeProps,
  onCleanup,
  onMount,
  type ParentProps,
  splitProps,
} from "solid-js";
import { produce } from "solid-js/store";

import { useInternalSolidFlow, useNodeId } from "@/components/contexts";
import type { Node, ResizeControlVariant } from "@/shared/types";

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
   * @example ControlPosition.TopLeft, ControlPosition.TopRight,
   * ControlPosition.BottomLeft, ControlPosition.BottomRight
   */
  readonly position?: ControlPosition;
  /** Variant of control
   * @example ResizeControlVariant.Handle, ResizeControlVariant.Line
   */
  readonly variant?: ResizeControlVariant;
  readonly style?: JSX.CSSProperties;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "onResize" | "style">;

const ResizeControl = <NodeType extends Node = Node>(props: ParentProps<ResizeControlProps>) => {
  const _props = mergeProps(
    {
      variant: "handle" as ResizeControlVariant,
      minWidth: 10,
      minHeight: 10,
      maxWidth: Number.MAX_VALUE,
      maxHeight: Number.MAX_VALUE,
      keepAspectRatio: false,
      autoScale: true,
      style: {} as JSX.CSSProperties,
    },
    props,
  );

  const [local, rest] = splitProps(_props, [
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

  let resizeControlRef!: HTMLDivElement;
  const { store, nodeLookup, setNodes } = useInternalSolidFlow<NodeType>();

  const ctxNodeId = useNodeId();
  const nodeId = () => local.nodeId ?? ctxNodeId();
  const isLineVariant = () => local.variant === "line";

  const controlPosition = () =>
    local.position ?? ((isLineVariant() ? "right" : "bottom-right") as ControlPosition);

  const positionClassNames = () => controlPosition().split("-");

  onMount(() => {
    const resizer = XYResizer({
      domNode: resizeControlRef,
      nodeId: nodeId(),
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
        const position = change.x && change.y ? { x: change.x, y: change.y } : undefined;
        changes.set(nodeId(), { ...change, position });

        for (const childChange of childChanges) {
          changes.set(childChange.id, {
            position: childChange.position,
          });
        }

        setNodes(
          (node) => changes.has(node.id),
          produce((node) => {
            const nodeChange = changes.get(node.id)!;

            node.width = nodeChange.width;
            node.height = nodeChange.height;
            node.position = {
              x: nodeChange.position?.x ?? node.position.x,
              y: nodeChange.position?.y ?? node.position.y,
            };
          }),
        );
      },
    });

    createEffect(() => {
      resizer.update({
        controlPosition: controlPosition(),
        boundaries: {
          minWidth: local.minWidth,
          minHeight: local.minHeight,
          maxWidth: local.maxWidth,
          maxHeight: local.maxHeight,
        },
        keepAspectRatio: !!local.keepAspectRatio,
        onResizeStart: local.onResizeStart,
        onResize: local.onResize,
        onResizeEnd: local.onResizeEnd,
        shouldResize: local.shouldResize,
      });
    });

    onCleanup(() => {
      resizer.destroy();
    });
  });

  return (
    <div
      ref={resizeControlRef}
      class={clsx([
        "solid-flow__resize-control",
        local.variant,
        store.noDragClass,
        ...positionClassNames(),
        local.class,
      ])}
      style={{
        "border-color": isLineVariant() ? local.color : undefined,
        "background-color": isLineVariant() ? undefined : local.color,
        scale:
          isLineVariant() || !local.autoScale ? undefined : Math.max(1 / store.viewport.zoom, 1),
        ...local.style,
      }}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export default ResizeControl;
