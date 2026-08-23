import type { JSX } from "@solidjs/web";
import { type ColorModeClass, infiniteExtent, isMacOs } from "@xyflow/system";
import {
  type Context,
  createEffect,
  createMemo,
  createSignal,
  merge,
  omit,
  onSettled,
  type ParentProps,
  untrack,
  useContext,
} from "solid-js";

import { createSolidFlow } from "@/browser/createSolidFlow";
import { ConnectionLine } from "@/components/connection";
import { EdgeRenderer, NodeRenderer, Pane, Viewport, Zoom } from "@/components/container";
import { NodeSelection, Selection } from "@/components/selection";
import { Attribution, KeyHandler } from "@/components/utility";
import { SolidFlowContext, type SolidFlowContextValue } from "@/contexts/flow";
import { getDefaultFlowStateProps } from "@/core/defaults";
import type { SolidFlowProps } from "@/core/flowProps";
import type { Edge, Node, PanOnScrollMode } from "@/types";
import { toPxString } from "@/utils";

import { A11yDescriptions } from "./accessibility";

type SolidFlowComponentProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = ParentProps<SolidFlowProps<NodeType, EdgeType>> &
  Omit<JSX.HTMLAttributes<HTMLDivElement>, "style" | "onselectionchange" | "onSelectionChange">;

/** The flow canvas component: renders nodes and edges and wires up viewport and interactions. */
export const SolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: SolidFlowComponentProps<NodeType, EdgeType>,
): JSX.Element => {
  const [domNodeRef, setDomNodeRef] = createSignal<HTMLDivElement>();
  let domNode!: HTMLDivElement;

  const _props = merge(
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

  const htmlProps = omit(
    _props,
    "nodes",
    "edges",
    "nodeTypes",
    "edgeTypes",
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
    "zIndexMode",
    "initialViewport",
    "viewport",
    "translateExtent",
    "nodeExtent",
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
    "autoPanOnSelection",
    "autoPanSpeed",
    "connectionRadius",
    "connectionMode",
    "connectionLineType",
    "connectionLineComponent",
    "connectionLineStyle",
    "connectionLineContainerStyle",
    "connectionDragThreshold",
    "isValidConnection",
    "clickConnect",
    "reconnectRadius",
    "selectionMode",
    "elementsSelectable",
    "nodesDraggable",
    "nodesConnectable",
    "nodesFocusable",
    "edgesFocusable",
    "disableKeyboardA11y",
    "ariaLabelConfig",
    "ariaLiveMessage",
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
    "attributionPosition",
    "proOptions",
    "onInit",
    "onMoveStart",
    "onMove",
    "onMoveEnd",
    "onFlowError",
    "onNodeClick",
    "onNodeContextMenu",
    "onNodeDrag",
    "onNodeDragStart",
    "onNodeDragStop",
    "onNodePointerEnter",
    "onNodePointerMove",
    "onNodePointerLeave",
    "onEdgeClick",
    "onEdgeContextMenu",
    "onEdgePointerEnter",
    "onEdgePointerLeave",
    "onPaneClick",
    "onPaneContextMenu",
    "onSelectionChange",
    "onSelectionClick",
    "onSelectionContextMenu",
    "onSelectionDrag",
    "onSelectionDragStart",
    "onSelectionDragStop",
    "onSelectionStart",
    "onSelectionEnd",
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
    "onDelete",
    "onBeforeDelete",
    "deleteKeyCode",
    "selectionKeyCode",
    "panActivationKeyCode",
    "multiSelectionKeyCode",
    "zoomActivationKeyCode",
    "children",
  );

  // Since we cannot pass generic types info at the point of context creation, we need to cast it here
  const TypedSolidFlowContext = SolidFlowContext as unknown as Context<
    SolidFlowContextValue<NodeType, EdgeType>
  >;

  const solidFlow = useContext(TypedSolidFlowContext) ?? createSolidFlow(_props);
  const { store, actions } = solidFlow;

  onSettled(() => {
    actions.applyInitialFitView(_props.fitView);
    actions.setConfig(_props);
    actions.setDomNode(domNode);

    return () => {
      actions.reset();
    };
  });

  // Sync with the container's real size (external system: ResizeObserver)
  createEffect(
    () => domNodeRef(),
    (el) => {
      if (!el) return;
      const observer = new ResizeObserver(() => {
        actions.setWidth(el.clientWidth);
        actions.setHeight(el.clientHeight);
      });
      observer.observe(el);
      return () => observer.disconnect();
    },
  );

  // Track panZoom too: the instance lands after mount, and the distance must
  // be (re)applied to each new instance
  createEffect(
    () => ({ panZoom: store.panZoom, distance: _props.paneClickDistance }),
    ({ panZoom, distance }) => {
      panZoom?.setClickDistance(distance);
    },
  );

  // Fires only when the set of selected ids changes, not on unrelated node/edge updates
  const selectedElements = createMemo(
    () => ({ nodes: store.selectedNodes, edges: store.selectedEdges }),
    {
      equals: (a, b) =>
        a.nodes.length === b.nodes.length &&
        a.edges.length === b.edges.length &&
        a.nodes.every((node, i) => node.id === b.nodes[i]!.id) &&
        a.edges.every((edge, i) => edge.id === b.edges[i]!.id),
    },
  );

  createEffect(
    () => selectedElements(),
    (params) => {
      untrack(() => _props.onSelectionChange)?.(params);
    },
  );

  const rootStyle = (): JSX.CSSProperties => ({
    width: toPxString(_props.width),
    height: toPxString(_props.height),
    ..._props.style,
  });

  return (
    <div
      role="application"
      data-testid="solid-flow__wrapper"
      ref={(el) => {
        domNode = el;
        setDomNodeRef(el);
      }}
      class={["solid-flow", "solid-flow__container", _props.class, store.colorMode]}
      style={rootStyle()}
      onScroll={(e) => {
        e.currentTarget.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }}
      {...htmlProps}
    >
      <TypedSolidFlowContext value={solidFlow}>
        <KeyHandler
          selectionKey={_props.selectionKey}
          deleteKey={_props.deleteKey}
          panActivationKey={_props.panActivationKey}
          multiSelectionKey={_props.multiSelectionKey}
          zoomActivationKey={_props.zoomActivationKey}
        />
        <Zoom
          panOnScrollMode={_props.panOnScrollMode}
          preventScrolling={_props.preventScrolling}
          zoomOnScroll={_props.zoomOnScroll}
          zoomOnDoubleClick={_props.zoomOnDoubleClick}
          zoomOnPinch={_props.zoomOnPinch}
          panOnScroll={_props.panOnScroll}
          panOnScrollSpeed={_props.panOnScrollSpeed}
          panOnDrag={_props.panOnDrag}
          paneClickDistance={_props.paneClickDistance}
          selectionOnDrag={_props.selectionOnDrag}
          onMoveStart={_props.onMoveStart}
          onMove={_props.onMove}
          onMoveEnd={_props.onMoveEnd}
          onViewportInitialized={_props.onInit}
          initialViewport={_props.viewport || _props.initialViewport}
        >
          <Pane
            onPaneClick={_props.onPaneClick}
            onPaneContextMenu={_props.onPaneContextMenu}
            onSelectionStart={_props.onSelectionStart}
            onSelectionEnd={_props.onSelectionEnd}
            panOnDrag={_props.panOnDrag}
            selectionOnDrag={_props.selectionOnDrag}
            paneClickDistance={_props.paneClickDistance}
            autoPanOnSelection={_props.autoPanOnSelection}
          >
            <Viewport>
              <div class="solid-flow__container solid-flow__viewport-back" />
              <EdgeRenderer<NodeType, EdgeType>
                reconnectRadius={_props.reconnectRadius}
                onEdgeClick={_props.onEdgeClick}
                onEdgeContextMenu={_props.onEdgeContextMenu}
                onEdgePointerEnter={_props.onEdgePointerEnter}
                onEdgePointerLeave={_props.onEdgePointerLeave}
                defaultEdgeOptions={_props.defaultEdgeOptions}
              />
              <div class="solid-flow__container solid-flow__edge-labels" />
              <ConnectionLine<NodeType>
                type={_props.connectionLineType}
                component={_props.connectionLineComponent}
                containerStyle={_props.connectionLineContainerStyle}
                style={_props.connectionLineStyle}
              />
              <NodeRenderer
                nodeClickDistance={_props.nodeClickDistance}
                onNodeClick={_props.onNodeClick}
                onNodeContextMenu={_props.onNodeContextMenu}
                onNodePointerEnter={_props.onNodePointerEnter}
                onNodePointerMove={_props.onNodePointerMove}
                onNodePointerLeave={_props.onNodePointerLeave}
                onNodeDrag={_props.onNodeDrag}
                onNodeDragStart={_props.onNodeDragStart}
                onNodeDragStop={_props.onNodeDragStop}
              />
              <NodeSelection
                onSelectionClick={_props.onSelectionClick}
                onSelectionContextMenu={_props.onSelectionContextMenu}
                onNodeDrag={_props.onNodeDrag}
                onNodeDragStart={_props.onNodeDragStart}
                onNodeDragStop={_props.onNodeDragStop}
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
        <Attribution proOptions={_props.proOptions} position={_props.attributionPosition} />
        <A11yDescriptions />
        {_props.children}
      </TypedSolidFlowContext>
    </div>
  );
};
