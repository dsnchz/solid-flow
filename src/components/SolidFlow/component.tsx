import {
  type ColorModeClass,
  devWarn,
  infiniteExtent,
  isMacOs,
  type OnError,
} from "@xyflow/system";
import clsx from "clsx";
import {
  batch,
  type Context,
  createEffect,
  type JSX,
  mergeProps,
  onCleanup,
  onMount,
  type ParentProps,
  splitProps,
  useContext,
} from "solid-js";

import { EdgeRenderer, NodeRenderer, Pane, Viewport, Zoom } from "@/components/container";
import { ConnectionLine } from "@/components/graph/connection";
import { NodeSelection, Selection } from "@/components/graph/selection";
import { Attribution, KeyHandler } from "@/components/utility";
import { createSolidFlow } from "@/data/createSolidFlow";
import { getDefaultFlowStateProps } from "@/data/defaults";
import type { PanOnScrollMode } from "@/shared/types";
import type { Edge, Node } from "@/types";
import { toPxString } from "@/utils";

import { A11yDescriptions } from "../accessibility";
import { SolidFlowContext, type SolidFlowContextValue } from "../contexts/flow";
import type { SolidFlowProps } from "./types";

type SolidFlowComponentProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = ParentProps<SolidFlowProps<NodeType, EdgeType>> &
  Omit<JSX.HTMLAttributes<HTMLDivElement>, "style" | "onselectionchange" | "onSelectionChange">;

export const SolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: SolidFlowComponentProps<NodeType, EdgeType>,
) => {
  let domNode!: HTMLDivElement;

  const _props = mergeProps(
    {
      ...getDefaultFlowStateProps<NodeType, EdgeType>(),
      colorMode: "light" as ColorModeClass,
      deleteKeyCode: "Backspace",
      defaultViewport: { x: 0, y: 0, zoom: 1 },
      isValidConnection: () => true,
      multiSelectionKeyCode: isMacOs() ? "Meta" : "Control",
      nodeClickDistance: 0,
      onFlowError: devWarn as OnError,
      panOnScroll: false,
      panActivationKeyCode: "Space",
      preventScrolling: true,
      panOnDrag: true,
      panOnScrollSpeed: 0.5,
      panOnScrollMode: "free" as PanOnScrollMode,
      paneClickDistance: 0,
      reconnectRadius: 10,
      selectionKeyCode: "Shift",
      selectionOnDrag: false,
      translateExtent: infiniteExtent,
      zoomActivationKeyCode: isMacOs() ? "Meta" : "Control",
      zoomOnPinch: true,
      zoomOnDoubleClick: true,
      zoomOnScroll: true,
    },
    props,
  );

  const [flowProps, htmlProps] = splitProps(_props, [
    // Core flow props
    "nodes",
    "edges",
    "nodeTypes",
    "edgeTypes",

    // Layout and viewport
    "width",
    "height",
    "fitView",
    "fitViewOptions",
    "nodeOrigin",
    "nodeDragThreshold",
    "paneClickDistance",
    "nodeClickDistance",
    "minZoom",
    "maxZoom",
    "initialViewport",
    "viewport",
    "translateExtent",
    "nodeExtent",

    // Interaction and behavior
    "selectionKey",
    "panActivationKey",
    "deleteKey",
    "multiSelectionKey",
    "zoomActivationKey",
    "panOnDrag",
    "panOnScroll",
    "panOnScrollMode",
    "panOnScrollSpeed",
    "selectionOnDrag",
    "selectNodesOnDrag",
    "preventScrolling",
    "zoomOnScroll",
    "zoomOnDoubleClick",
    "zoomOnPinch",
    "onlyRenderVisibleElements",
    "autoPanOnConnect",
    "autoPanOnNodeDrag",
    "autoPanOnNodeFocus",
    "autoPanSpeed",

    // Connection and validation
    "connectionRadius",
    "connectionMode",
    "connectionLineType",
    "connectionLineComponent",
    "connectionLineStyle",
    "connectionLineContainerStyle",
    "isValidConnection",
    "clickConnect",
    "reconnectRadius",

    // Selection and accessibility
    "selectionMode",
    "elementsSelectable",
    "nodesDraggable",
    "nodesConnectable",
    "nodesFocusable",
    "edgesFocusable",
    "disableKeyboardA11y",
    "ariaLabelConfig",
    "ariaLiveMessage",

    // Styling and theming
    "colorMode",
    "colorModeSSR",
    "class",
    "style",
    "snapGrid",
    "defaultMarkerColor",
    "defaultEdgeOptions",
    "elevateNodesOnSelect",
    "elevateEdgesOnSelect",
    "noDragClass",
    "noPanClass",
    "noWheelClass",

    // Attribution and pro features
    "attributionPosition",
    "proOptions",

    // Event handlers - Flow lifecycle
    "onInit",
    "onMoveStart",
    "onMove",
    "onMoveEnd",
    "onFlowError",

    // Event handlers - Node events
    "onNodeClick",
    "onNodeContextMenu",
    "onNodeDrag",
    "onNodeDragStart",
    "onNodeDragStop",
    "onNodePointerEnter",
    "onNodePointerMove",
    "onNodePointerLeave",

    // Event handlers - Edge events
    "onEdgeClick",
    "onEdgeContextMenu",
    "onEdgePointerEnter",
    "onEdgePointerLeave",

    // Event handlers - Pane events
    "onPaneClick",
    "onPaneContextMenu",

    // Event handlers - Selection events
    "onSelectionChange",
    "onSelectionClick",
    "onSelectionContextMenu",
    "onSelectionDrag",
    "onSelectionDragStart",
    "onSelectionDragStop",
    "onSelectionStart",
    "onSelectionEnd",

    // Event handlers - Connection events
    "onConnect",
    "onConnectStart",
    "onConnectEnd",
    "onReconnect",
    "onReconnectStart",
    "onReconnectEnd",
    "onClickConnectStart",
    "onClickConnectEnd",
    "onBeforeConnect",
    "onBeforeReconnect",

    // Event handlers - Delete events
    "onDelete",
    "onBeforeDelete",

    // Legacy/deprecated props
    "deleteKeyCode",
    "selectionKeyCode",
    "panActivationKeyCode",
    "multiSelectionKeyCode",
    "zoomActivationKeyCode",

    // Special props that conflict with HTML
    "children",
  ]);

  // Since we cannot pass generic types info at the point of context creation, we need to cast it here
  const TypedSolidFlowContext = SolidFlowContext as unknown as Context<
    SolidFlowContextValue<NodeType, EdgeType>
  >;

  const solidFlow = useContext(TypedSolidFlowContext) ?? createSolidFlow(_props);
  const { store, actions } = solidFlow;

  onMount(() => {
    batch(() => {
      actions.setConfig(_props);
      // NOTE: should we check here if we have explicitly provided a width/height via props?
      actions.setWidth(domNode.clientWidth);
      actions.setHeight(domNode.clientHeight);
      actions.setDomNode(domNode);
    });

    createEffect(() => {
      actions.setPaneClickDistance(flowProps.paneClickDistance);
    });

    onCleanup(() => {
      actions.reset();
    });
  });

  const onScroll = (e: Event & { currentTarget: EventTarget & HTMLDivElement }) => {
    e.currentTarget.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const rootStyle = (): JSX.CSSProperties => ({
    width: toPxString(flowProps.width),
    height: toPxString(flowProps.height),
    ...flowProps.style,
  });

  return (
    <TypedSolidFlowContext.Provider value={solidFlow}>
      <div
        role="application"
        data-testid="solid-flow__wrapper"
        ref={domNode}
        class={clsx(["solid-flow", "solid-flow__container", flowProps.class, store.colorMode])}
        style={rootStyle()}
        onScroll={onScroll}
        {...htmlProps}
      >
        <KeyHandler
          selectionKey={flowProps.selectionKey}
          deleteKey={flowProps.deleteKey}
          panActivationKey={flowProps.panActivationKey}
          multiSelectionKey={flowProps.multiSelectionKey}
          zoomActivationKey={flowProps.zoomActivationKey}
        />
        <Zoom
          panOnScrollMode={flowProps.panOnScrollMode}
          preventScrolling={flowProps.preventScrolling}
          zoomOnScroll={flowProps.zoomOnScroll}
          zoomOnDoubleClick={flowProps.zoomOnDoubleClick}
          zoomOnPinch={flowProps.zoomOnPinch}
          panOnScroll={flowProps.panOnScroll}
          panOnDrag={flowProps.panOnDrag}
          paneClickDistance={flowProps.paneClickDistance}
          onMoveStart={flowProps.onMoveStart}
          onMove={flowProps.onMove}
          onMoveEnd={flowProps.onMoveEnd}
          onViewportInitialized={flowProps.onInit}
          initialViewport={flowProps.viewport || flowProps.initialViewport}
        >
          <Pane
            onPaneClick={flowProps.onPaneClick}
            onPaneContextMenu={flowProps.onPaneContextMenu}
            onSelectionStart={flowProps.onSelectionStart}
            onSelectionEnd={flowProps.onSelectionEnd}
            panOnDrag={flowProps.panOnDrag}
            selectionOnDrag={flowProps.selectionOnDrag}
          >
            <Viewport>
              <div class="solid-flow__container solid-flow__viewport-back" />
              <EdgeRenderer<NodeType, EdgeType>
                reconnectRadius={flowProps.reconnectRadius}
                onEdgeClick={flowProps.onEdgeClick}
                onEdgeContextMenu={flowProps.onEdgeContextMenu}
                onEdgePointerEnter={flowProps.onEdgePointerEnter}
                onEdgePointerLeave={flowProps.onEdgePointerLeave}
                defaultEdgeOptions={flowProps.defaultEdgeOptions}
              />
              <div class="solid-flow__container solid-flow__edge-labels" />
              <ConnectionLine<NodeType>
                type={flowProps.connectionLineType}
                component={flowProps.connectionLineComponent}
                containerStyle={flowProps.connectionLineContainerStyle}
                style={flowProps.connectionLineStyle}
              />
              <NodeRenderer
                nodeClickDistance={flowProps.nodeClickDistance}
                onNodeClick={flowProps.onNodeClick}
                onNodeContextMenu={flowProps.onNodeContextMenu}
                onNodePointerEnter={flowProps.onNodePointerEnter}
                onNodePointerMove={flowProps.onNodePointerMove}
                onNodePointerLeave={flowProps.onNodePointerLeave}
                onNodeDrag={flowProps.onNodeDrag}
                onNodeDragStart={flowProps.onNodeDragStart}
                onNodeDragStop={flowProps.onNodeDragStop}
              />
              <NodeSelection
                onSelectionClick={flowProps.onSelectionClick}
                onSelectionContextMenu={flowProps.onSelectionContextMenu}
                onNodeDrag={flowProps.onNodeDrag}
                onNodeDragStart={flowProps.onNodeDragStart}
                onNodeDragStop={flowProps.onNodeDragStop}
              />
            </Viewport>
            <Selection
              isVisible={!!store.selectionRect && store.selectionRectMode === "user"}
              width={store.selectionRect?.width}
              height={store.selectionRect?.height}
              x={store.selectionRect?.x}
              y={store.selectionRect?.y}
            />
          </Pane>
        </Zoom>
        <Attribution proOptions={flowProps.proOptions} position={flowProps.attributionPosition} />
        <A11yDescriptions />
        {flowProps.children}
      </div>
    </TypedSolidFlowContext.Provider>
  );
};
