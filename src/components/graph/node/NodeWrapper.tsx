import {
  elementSelectionKeys,
  errorMessages,
  getNodesInside,
  isInputDOMNode,
  nodeHasDimensions,
  Position,
} from "@xyflow/system";
import clsx from "clsx";
import { batch, createEffect, createSignal, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import createDraggable from "@/actions/createDraggable";
import { ARIA_NODE_DESC_KEY } from "@/components/accessibility";
import { useInternalSolidFlow } from "@/components/contexts";
import { NodeConnectableContext } from "@/components/contexts/nodeConnectable";
import { NodeIdContext } from "@/components/contexts/nodeId";
import type { Node, NodeEvents } from "@/types";
import { ARROW_KEY_DIFFS, toPxString } from "@/utils";

export type NodeWrapperProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  readonly nodeId: string;
  readonly resizeObserver: ResizeObserver;
  readonly nodeClickDistance: number;
};

const NodeWrapper = <NodeType extends Node = Node>(props: NodeWrapperProps<NodeType>) => {
  const { store, nodeLookup, parentLookup, actions } = useInternalSolidFlow<NodeType>();

  const [nodeRef, setNodeRef] = createSignal<HTMLDivElement>();

  const node = () => nodeLookup.get(props.nodeId)!;

  const nodeId = () => node().id;
  const nodeType = () => node().type ?? "default";
  const deletable = () => node().deletable ?? true;
  const selectable = () => node().selectable ?? store.elementsSelectable;
  const focusable = () => node().focusable ?? store.nodesFocusable;
  const draggable = () => node().draggable ?? store.nodesDraggable;
  const connectable = () => node().connectable ?? store.nodesConnectable;
  const userNode = () => node().internals.userNode;

  const nodeTypeValid = () => nodeType() in store.nodeTypes;
  const nodeComponent = () => store.nodeTypes[nodeType()];
  const isParentNode = () => parentLookup.has(node().id);

  const transform = () => {
    const { x, y } = node().internals.positionAbsolute;
    return `translate(${x}px, ${y}px)`;
  };

  const sizeStyle = () => {
    const w = node().width ?? node().initialWidth;
    const h = node().height ?? node().initialHeight;

    return {
      ...node().style,
      ...(w ? { width: toPxString(w) } : {}),
      ...(h ? { height: toPxString(h) } : {}),
    };
  };

  const style = () =>
    ({
      "z-index": node().internals.z,
      transform: transform(),
      visibility: nodeHasDimensions(node()) ? "visible" : "hidden",
      ...sizeStyle(),
      ...(node().style ?? {}),
    }) as const;

  createEffect(() => {
    if (!nodeTypeValid()) {
      console.warn("003", errorMessages["error003"](nodeType()));
    }
  });

  createEffect<{
    sourcePosition: Position | undefined;
    targetPosition: Position | undefined;
    nodeType: string;
  }>((prev) => {
    if (
      prev &&
      prev.sourcePosition === node().sourcePosition &&
      prev.targetPosition === node().targetPosition &&
      prev.nodeType === nodeType()
    ) {
      return prev;
    }

    actions.updateNodeInternals(
      new Map([
        [
          node().id,
          {
            id: node().id,
            nodeElement: nodeRef()!,
            force: true,
          },
        ],
      ]),
    );

    return {
      nodeType: nodeType(),
      sourcePosition: node().sourcePosition,
      targetPosition: node().targetPosition,
    };
  });

  createEffect<HTMLDivElement | undefined>((prevNodeRef) => {
    const currentNodeRef = nodeRef();

    if (currentNodeRef === prevNodeRef && nodeHasDimensions(node())) {
      return prevNodeRef;
    }

    if (prevNodeRef) {
      props.resizeObserver.unobserve(prevNodeRef);
    }

    if (currentNodeRef) {
      props.resizeObserver.observe(currentNodeRef);
    }

    return currentNodeRef;
  });

  const onSelectNodeHandler = (event: MouseEvent) => {
    if (selectable() && (!store.selectNodesOnDrag || !draggable() || store.nodeDragThreshold > 0)) {
      // this handler gets called by XYDrag on drag start when selectNodesOnDrag=true
      // here we only need to call it when selectNodesOnDrag=false
      actions.handleNodeSelection(node().id);
    }

    props.onNodeClick?.({ node: userNode(), event });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isInputDOMNode(event) || store.disableKeyboardA11y) {
      return;
    }

    if (elementSelectionKeys.includes(event.key) && selectable()) {
      actions.handleNodeSelection(node().id, event.key === "Escape", nodeRef());
      return;
    }

    const arrowKeyDiff = ARROW_KEY_DIFFS[event.key];

    if (draggable() && node().selected && arrowKeyDiff) {
      batch(() => {
        // prevent default scrolling behavior on arrow key press when node is moved
        event.preventDefault();
        actions.setAriaLiveMessage(
          store.ariaLabelConfig["node.a11yDescription.ariaLiveMessage"]({
            direction: event.key.replace("Arrow", "").toLowerCase(),
            x: ~~node().internals.positionAbsolute.x,
            y: ~~node().internals.positionAbsolute.y,
          }),
        );

        actions.moveSelectedNodes(arrowKeyDiff, event.shiftKey ? 4 : 1);
      });
    }
  };

  const onFocus = () => {
    if (
      store.disableKeyboardA11y ||
      !store.autoPanOnNodeFocus ||
      !nodeRef()?.matches(":focus-visible")
    ) {
      return;
    }

    const { width, height, viewport } = store;

    const withinViewport =
      getNodesInside(
        new Map([[node().id, node()]]),
        { x: 0, y: 0, width, height },
        [viewport.x, viewport.y, viewport.zoom],
        true,
      ).length > 0;

    if (withinViewport) return;

    void actions.setCenter(
      node().position.x + (node().measured.width ?? 0) / 2,
      node().position.y + (node().measured.height ?? 0) / 2,
      { zoom: viewport.zoom },
    );
  };

  const dragging = createDraggable(nodeRef, () => ({
    nodeId: node().id,
    isSelectable: selectable(),
    disabled: !draggable(),
    handleSelector: node().dragHandle,
    noDragClass: store.noDragClass,
    nodeClickDistance: props.nodeClickDistance,
    onNodeMouseDown: actions.handleNodeSelection,
    onDrag: (event, _, targetNode, nodes) => {
      props.onNodeDrag?.({ event, targetNode: targetNode as NodeType, nodes: nodes as NodeType[] });
    },
    onDragStart: (event, _, targetNode, nodes) => {
      props.onNodeDragStart?.({
        event,
        targetNode: targetNode as NodeType,
        nodes: nodes as NodeType[],
      });
    },
    onDragStop: (event, _, targetNode, nodes) => {
      props.onNodeDragStop?.({
        event,
        targetNode: targetNode as NodeType,
        nodes: nodes as NodeType[],
      });
    },
  }));

  return (
    <Show when={!node().hidden}>
      <div
        ref={setNodeRef}
        data-id={node().id}
        class={clsx(
          "solid-flow__node",
          nodeType(),
          {
            connectable: connectable(),
            draggable: draggable(),
            dragging: dragging(),
            nopan: draggable(),
            parent: isParentNode(),
            selectable: selectable(),
            selected: node().selected,
          },
          node().class,
        )}
        style={style()}
        onClick={onSelectNodeHandler}
        onPointerEnter={(event) => props.onNodePointerEnter?.({ node: userNode(), event })}
        onPointerLeave={(event) => props.onNodePointerLeave?.({ node: userNode(), event })}
        onPointerMove={(event) => props.onNodePointerMove?.({ node: userNode(), event })}
        onContextMenu={(event) => props.onNodeContextMenu?.({ node: userNode(), event })}
        onKeyDown={(e) => focusable() && onKeyDown(e)}
        onFocus={() => focusable() && onFocus()}
        tabIndex={focusable() ? 0 : undefined}
        role={node().ariaRole ?? (focusable() ? "group" : undefined)}
        aria-roledescription="node"
        aria-describedby={
          store.disableKeyboardA11y ? undefined : `${ARIA_NODE_DESC_KEY}-${store.id}`
        }
        {...node().domAttributes}
      >
        <NodeIdContext.Provider value={nodeId}>
          <NodeConnectableContext.Provider value={connectable}>
            <Dynamic
              component={nodeComponent()}
              data={node().data}
              id={node().id}
              selected={Boolean(node().selected)}
              selectable={selectable()}
              deletable={deletable()}
              sourcePosition={node().sourcePosition}
              targetPosition={node().targetPosition}
              zIndex={node().internals.z}
              dragging={dragging()}
              draggable={draggable()}
              dragHandle={node().dragHandle}
              parentId={node().parentId}
              type={nodeType()}
              isConnectable={connectable()}
              positionAbsoluteX={node().internals.positionAbsolute.x}
              positionAbsoluteY={node().internals.positionAbsolute.y}
              width={node().width}
              height={node().height}
            />
          </NodeConnectableContext.Provider>
        </NodeIdContext.Provider>
      </div>
    </Show>
  );
};

export default NodeWrapper;
