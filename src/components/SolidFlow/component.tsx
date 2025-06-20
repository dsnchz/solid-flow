import {
  type ColorModeClass,
  devWarn,
  infiniteExtent,
  isMacOs,
  mergeAriaLabelConfig,
  type OnError,
} from "@xyflow/system";
import clsx from "clsx";
import {
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
import { produce } from "solid-js/store";

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
      multiSelectionKeyCode: isMacOs() ? "Meta" : "Control",
      nodeClickDistance: 0,
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
  const { store, reset, setStore, setNodes, setEdges, setPaneClickDistance } = solidFlow;

  onMount(() => {
    setStore(
      produce((store) => {
        store.domNode = domNode;
        store.width = domNode.clientWidth;
        store.height = domNode.clientHeight;
      }),
    );

    setNodes(flowProps.nodes);
    setEdges(flowProps.edges);

    createEffect(() => {
      setStore(
        produce((store) => {
          store._colorMode = flowProps.colorMode;
          store._colorModeSSR = flowProps.colorModeSSR;
          store._nodeTypes = flowProps.nodeTypes;
          store._edgeTypes = flowProps.edgeTypes;

          store.minZoom = flowProps.minZoom;
          store.maxZoom = flowProps.maxZoom;
          // store.viewport = flowProps.viewport ?? flowProps.initialViewport;

          store.autoPanSpeed = flowProps.autoPanSpeed;
          store.elevateNodesOnSelect = flowProps.elevateNodesOnSelect;
          store.defaultEdgeOptions = flowProps.defaultEdgeOptions;
          store.nodeOrigin = flowProps.nodeOrigin;
          store.nodeDragThreshold = flowProps.nodeDragThreshold;
          store.nodeExtent = flowProps.nodeExtent;
          store.translateExtent = flowProps.translateExtent;

          store.snapGrid = flowProps.snapGrid;
          store.selectionMode = flowProps.selectionMode;
          store.nodesDraggable = flowProps.nodesDraggable;
          store.nodesFocusable = flowProps.nodesFocusable;
          store.nodesConnectable = flowProps.nodesConnectable;
          store.edgesFocusable = flowProps.edgesFocusable;
          store.elementsSelectable = flowProps.elementsSelectable;
          store.selectNodesOnDrag = flowProps.selectNodesOnDrag;
          store.onlyRenderVisibleElements = flowProps.onlyRenderVisibleElements;
          store.defaultMarkerColor = flowProps.defaultMarkerColor;
          store.connectionMode = flowProps.connectionMode;
          store.connectionLineType = flowProps.connectionLineType;
          store.connectionRadius = flowProps.connectionRadius;
          store.elevateEdgesOnSelect = flowProps.elevateEdgesOnSelect;
          store.disableKeyboardA11y = flowProps.disableKeyboardA11y;
          store.autoPanOnNodeDrag = flowProps.autoPanOnNodeDrag;
          store.autoPanOnConnect = flowProps.autoPanOnConnect;
          store.autoPanOnNodeFocus = flowProps.autoPanOnNodeFocus;
          store.noPanClass = flowProps.noPanClass;
          store.noDragClass = flowProps.noDragClass;
          store.noWheelClass = flowProps.noWheelClass;
          store.ariaLiveMessage = flowProps.ariaLiveMessage;
          store.ariaLabelConfig = mergeAriaLabelConfig(flowProps.ariaLabelConfig);

          store.isValidConnection = flowProps.isValidConnection ?? (() => true);
          store.onError = flowProps.onFlowError ?? (devWarn as OnError);
          store.onDelete = flowProps.onDelete;
          store.onBeforeDelete = flowProps.onBeforeDelete;
          store.onBeforeConnect = flowProps.onBeforeConnect;
          store.onConnect = flowProps.onConnect;
          store.onConnectStart = flowProps.onConnectStart;
          store.onConnectEnd = flowProps.onConnectEnd;
          store.onBeforeReconnect = flowProps.onBeforeReconnect;
          store.onReconnect = flowProps.onReconnect;
          store.onReconnectStart = flowProps.onReconnectStart;
          store.onReconnectEnd = flowProps.onReconnectEnd;
          store.clickConnect = flowProps.clickConnect ?? true;
          store.onClickConnectStart = flowProps.onClickConnectStart;
          store.onClickConnectEnd = flowProps.onClickConnectEnd;
          store.onSelectionDrag = flowProps.onSelectionDrag;
          store.onSelectionDragStart = flowProps.onSelectionDragStart;
          store.onSelectionDragStop = flowProps.onSelectionDragStop;
        }),
      );

      setPaneClickDistance(flowProps.paneClickDistance);
    });

    onCleanup(() => {
      reset();
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
