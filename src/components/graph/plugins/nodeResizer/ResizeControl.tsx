import {
  type ControlPosition,
  XYResizer,
  type XYResizerChange,
  type XYResizerChildChange,
} from "@xyflow/system";
import clsx from "clsx";
import { createEffect, onCleanup, onMount, type ParentComponent } from "solid-js";

import { useFlowStore, useNodeId } from "@/components/contexts";
import type { ResizeControlVariant } from "@/shared/types";

import type { NodeResizerProps } from "./NodeResizer";

type ResizeControlProps = Pick<
  NodeResizerProps,
  | "nodeId"
  | "color"
  | "minWidth"
  | "minHeight"
  | "maxWidth"
  | "maxHeight"
  | "keepAspectRatio"
  | "shouldResize"
  | "onResizeStart"
  | "onResize"
  | "onResizeEnd"
> & {
  /** Position of control
   * @example ControlPosition.TopLeft, ControlPosition.TopRight,
   * ControlPosition.BottomLeft, ControlPosition.BottomRight
   */
  readonly position: ControlPosition;
  /** Variant of control
   * @example ResizeControlVariant.Handle, ResizeControlVariant.Line
   */
  readonly variant: ResizeControlVariant;
  readonly class: string;
  readonly style: string;
};

const ResizeControl: ParentComponent<Partial<ResizeControlProps>> = (props) => {
  const { store, setNodes } = useFlowStore();
  const contextNodeId = useNodeId();

  let resizeControlRef!: HTMLDivElement;

  const getId = () => (typeof props.nodeId === "string" ? props.nodeId : contextNodeId());

  const getDefaultPosition = () =>
    (props.variant === "line" ? "right" : "bottom-right") as ControlPosition;

  const getControlPosition = () => props.position ?? getDefaultPosition();
  const getPositionClassNames = () => getControlPosition().split("-");

  const getColorStyleProp = () => (props.variant === "line" ? "border-color" : "background-color");
  const getStyle = () => props.style ?? "";
  const getControlStyle = () =>
    props.color ? `${getStyle()} ${getColorStyleProp()}: ${props.color};` : getStyle();

  const getMinWidth = () => props.minWidth ?? 10;
  const getMinHeight = () => props.minHeight ?? 10;
  const getMaxWidth = () => props.maxWidth ?? Number.MAX_VALUE;
  const getMaxHeight = () => props.maxHeight ?? Number.MAX_VALUE;

  onMount(() => {
    const resizer = XYResizer({
      domNode: resizeControlRef,
      nodeId: getId(),
      getStoreItems: () => {
        return {
          nodeLookup: store.nodeLookup,
          transform: store.transform,
          snapGrid: store.snapGrid ?? undefined,
          snapToGrid: !!store.snapGrid,
          nodeOrigin: store.nodeOrigin,
          paneDomNode: store.domNode,
        };
      },
      onChange: (change: XYResizerChange, childChanges: XYResizerChildChange[]) => {
        const node = store.nodeLookup.get(getId())?.internals.userNode;
        if (!node) {
          return;
        }

        if (change.x !== undefined && change.y !== undefined) {
          node.position = { x: change.x, y: change.y };
        }

        if (change.width !== undefined && change.height !== undefined) {
          node.width = change.width;
          node.height = change.height;
        }

        for (const childChange of childChanges) {
          const childNode = store.nodeLookup.get(childChange.id)?.internals.userNode;
          if (childNode) {
            childNode.position = childChange.position;
          }
        }

        setNodes((nodes) => nodes);
      },
    });

    createEffect(() => {
      resizer.update({
        controlPosition: getControlPosition(),
        boundaries: {
          minWidth: getMinWidth(),
          minHeight: getMinHeight(),
          maxWidth: getMaxWidth(),
          maxHeight: getMaxHeight(),
        },
        keepAspectRatio: !!props.keepAspectRatio,
        onResizeStart: props.onResizeStart,
        onResize: props.onResize,
        onResizeEnd: props.onResizeEnd,
        shouldResize: props.shouldResize,
      });
    });

    onCleanup(() => {
      resizer.destroy();
    });
  });

  return (
    <div
      class={clsx([
        "solid-flow__resize-control",
        "nodrag",
        ...getPositionClassNames(),
        props.variant,
        props.class,
      ])}
      ref={resizeControlRef}
      style={getControlStyle()}
    >
      {props.children}
    </div>
  );
};

export default ResizeControl;
