import { errorMessages, nodeHasDimensions, Position } from "@xyflow/system";
import clsx from "clsx";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import createDraggable from "@/actions/createDraggable";
import { useFlowStore } from "@/components/contexts";
import { NodeIdContext } from "@/components/contexts/nodeId";
import type { InternalNode, Node, NodeEventCallbacks } from "@/shared/types";
import type { MouseOrTouchEvent } from "@/shared/types/events";

import DefaultNode from "./DefaultNode";

function getNodeInlineStyleDimensions({
  width,
  height,
  initialWidth,
  initialHeight,
  measuredWidth,
  measuredHeight,
}: {
  width?: number;
  height?: number;
  initialWidth?: number;
  initialHeight?: number;
  measuredWidth?: number;
  measuredHeight?: number;
}): {
  width: string | undefined;
  height: string | undefined;
} {
  if (measuredWidth === undefined && measuredHeight === undefined) {
    const styleWidth = width ?? initialWidth;
    const styleHeight = height ?? initialHeight;

    return {
      width: styleWidth ? `width:${styleWidth}px;` : "",
      height: styleHeight ? `height:${styleHeight}px;` : "",
    };
  }

  return {
    width: width ? `width:${width}px;` : "",
    height: height ? `height:${height}px;` : "",
  };
}

export type NodeWrapperProps<NodeType extends Node = Node> = {
  readonly node: InternalNode<NodeType>;
  readonly resizeObserver: ResizeObserver;
  readonly nodeClickDistance: number;
} & Partial<NodeEventCallbacks<NodeType>>;

const NodeWrapper = <NodeType extends Node = Node>(props: NodeWrapperProps<NodeType>) => {
  const { store, updateNodeInternals, handleNodeSelection } = useFlowStore<NodeType>();

  const [nodeRef, setNodeRef] = createSignal<HTMLDivElement>();

  let prevNodeRef: HTMLDivElement | undefined = undefined;
  let prevType: string | undefined = undefined;
  let prevSourcePosition: Position | undefined = undefined;
  let prevTargetPosition: Position | undefined = undefined;

  const nodeId = () => props.node.id;
  const nodeInternals = () => props.node.internals;

  const nodeStyle = () =>
    props.node.style && typeof props.node.style === "object" ? props.node.style : {};
  const nodeType = () => props.node.type ?? "default";
  const nodeZIndex = () => nodeInternals().z ?? 0;
  const nodeTypeValid = () => nodeType() in store.nodeTypes;
  const nodeComponent = () => store.nodeTypes[nodeType()] || DefaultNode;

  const isParentNode = () => store.parentLookup.has(props.node.id);
  const isNodeDelatable = () => props.node.deletable ?? true;
  const isNodeInitialized = () => nodeHasDimensions(props.node);

  const isNodeSelectable = () =>
    Boolean(
      props.node.selectable ||
        (store.elementsSelectable && typeof props.node.selectable === "undefined"),
    );

  const isNodeDraggable = () =>
    Boolean(
      props.node.draggable || (store.nodesDraggable && typeof props.node.draggable === "undefined"),
    );

  const isNodeConnectable = () =>
    Boolean(
      props.node.connectable ||
        (store.nodesConnectable && typeof props.node.connectable === "undefined"),
    );

  const dragging = createDraggable(nodeRef, () => ({
    nodeId: props.node.id,
    isSelectable: isNodeSelectable(),
    disabled: false,
    handleSelector: props.node.dragHandle,
    noDragClass: "nodrag",
    nodeClickDistance: props.nodeClickDistance,
    onNodeMouseDown: handleNodeSelection,
    onDrag: (event, _, targetNode, nodes) => {
      props.onNodeDrag?.(targetNode, nodes, event);
    },
    onDragStart: (event, _, targetNode, nodes) => {
      props.onNodeDragStart?.(targetNode, nodes, event);
    },
    onDragStop: (event, _, targetNode, nodes) => {
      props.onNodeDragStop?.(targetNode, nodes, event);
    },
  }));

  const inlineStyleDimensions = () =>
    getNodeInlineStyleDimensions({
      width: props.node.width,
      height: props.node.height,
      initialWidth: props.node.initialWidth,
      initialHeight: props.node.initialHeight,
      measuredWidth: props.node.measured.width,
      measuredHeight: props.node.measured.height,
    });

  const transform = () =>
    `translate(${nodeInternals().positionAbsolute.x}px, ${nodeInternals().positionAbsolute.y}px)`;

  const style = () =>
    ({
      "z-index": nodeZIndex(),
      transform: transform(),
      visibility: isNodeInitialized() ? "visible" : "hidden",
      ...nodeStyle(),
      ...inlineStyleDimensions(),
    }) as const;

  createEffect(() => {
    if (!nodeTypeValid()) {
      console.warn("003", errorMessages["error003"](nodeType()));
    }
  });

  createEffect(() => {
    // if type, sourcePosition or targetPosition changes,
    // we need to re-calculate the handle positions
    const doUpdate = Boolean(
      (prevType && nodeType() !== prevType) ||
        (prevSourcePosition && props.node.sourcePosition !== prevSourcePosition) ||
        (prevTargetPosition && props.node.targetPosition !== prevTargetPosition),
    );

    if (doUpdate) {
      requestAnimationFrame(() =>
        updateNodeInternals(
          new Map([
            [
              props.node.id,
              {
                id: props.node.id,
                nodeElement: nodeRef()!,
                force: true,
              },
            ],
          ]),
        ),
      );
    }

    prevType = nodeType();
    prevSourcePosition = props.node.sourcePosition;
    prevTargetPosition = props.node.targetPosition;
  });

  createEffect(() => {
    if (nodeRef() !== prevNodeRef || !isNodeInitialized()) {
      if (prevNodeRef) {
        props.resizeObserver.unobserve(prevNodeRef);
      }
      props.resizeObserver.observe(nodeRef()!);
      prevNodeRef = nodeRef();
    }
  });

  onCleanup(() => {
    if (prevNodeRef) {
      props.resizeObserver.unobserve(prevNodeRef);
    }
  });

  const onSelectNodeHandler = (event: MouseOrTouchEvent) => {
    if (
      isNodeSelectable() &&
      (!store.selectNodesOnDrag || !isNodeDraggable() || store.nodeDragThreshold > 0)
    ) {
      // this handler gets called by XYDrag on drag start when selectNodesOnDrag=true
      // here we only need to call it when selectNodesOnDrag=false
      handleNodeSelection(props.node.id);
    }

    props.onNodeClick?.(props.node, event);
  };

  return (
    <Show when={!props.node.hidden}>
      <div
        ref={setNodeRef}
        data-id={props.node.id}
        onClick={onSelectNodeHandler}
        onMouseEnter={(event) => props.onNodeMouseEnter?.(props.node, event)}
        onMouseLeave={(event) => props.onNodeMouseLeave?.(props.node, event)}
        onMouseMove={(event) => props.onNodeMouseMove?.(props.node, event)}
        onContextMenu={(event) => props.onNodeContextMenu?.(props.node, event)}
        style={style()}
        class={clsx(
          "solid-flow__node",
          nodeType(),
          {
            dragging: dragging(),
            selected: props.node.selected,
            draggable: isNodeDraggable(),
            connectable: isNodeConnectable(),
            selectable: isNodeSelectable(),
            nopan: isNodeDraggable(),
            parent: isParentNode(),
          },
          props.node.class,
        )}
      >
        <NodeIdContext.Provider value={nodeId}>
          <Dynamic
            component={nodeComponent()}
            type={nodeType()}
            id={props.node.id}
            parentId={props.node.parentId}
            data={props.node.data}
            width={`${props.node.width}px`}
            height={`${props.node.height}px`}
            dragHandle={props.node.dragHandle}
            selected={Boolean(props.node.selected)}
            dragging={dragging()}
            zIndex={nodeZIndex()}
            draggable={isNodeDraggable()}
            deletable={isNodeDelatable()}
            selectable={isNodeSelectable()}
            isConnectable={isNodeConnectable()}
            sourcePosition={props.node.sourcePosition}
            targetPosition={props.node.targetPosition}
            positionAbsoluteX={nodeInternals().positionAbsolute.x}
            positionAbsoluteY={nodeInternals().positionAbsolute.y}
          />
        </NodeIdContext.Provider>
      </div>
    </Show>
  );
};

export default NodeWrapper;
