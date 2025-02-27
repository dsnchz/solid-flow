import { PanOnScrollMode } from "@xyflow/system";
import clsx from "clsx";
import { type Context, createEffect, onCleanup, onMount, type ParentProps } from "solid-js";
import { produce } from "solid-js/store";

import { EdgeRenderer, NodeRenderer, Pane, Viewport, Zoom } from "@/components/container";
import { ConnectionLine } from "@/components/graph/connection";
import { NodeSelection, UserSelection } from "@/components/graph/selection";
import { Attribution, KeyHandler } from "@/components/utility";
import { createSolidFlow } from "@/data/createSolidFlow";
import { setColorModeClass } from "@/shared/signals/colorModeClass";
import { colorModeClass } from "@/shared/signals/colorModeClass";
import type { Edge, Node } from "@/shared/types";

import { SolidFlowContext, type SolidFlowContextValue } from "../contexts/flow";
import type { SolidFlowProps } from "./types";
import { updateStore, updateStoreByKeys } from "./utils";

const SolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<Partial<SolidFlowProps<NodeType, EdgeType>>>,
) => {
  let domNode!: HTMLDivElement;

  const solidFlow = createSolidFlow(props);
  const { store, reset, setStore, setPaneClickDistance } = solidFlow;

  onMount(() => {
    setStore(
      produce((store) => {
        store.domNode = domNode;
        store.width = domNode.clientWidth;
        store.height = domNode.clientHeight;
      }),
    );

    if (props.paneClickDistance !== undefined) {
      setPaneClickDistance(props.paneClickDistance);
    }

    if (props.fitView !== undefined) {
      setStore("fitViewOnInit", props.fitView);
    }

    if (props.fitViewOptions !== undefined) {
      setStore("fitViewOptions", props.fitViewOptions);
    }

    updateStore(setStore, {
      nodeTypes: props.nodeTypes,
      edgeTypes: props.edgeTypes,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      translateExtent: props.translateExtent,
    });

    onCleanup(() => {
      reset();
    });
  });

  // Call oninit once when flow is initialized
  let onInitCalled = false;
  createEffect(() => {
    if (!onInitCalled && store.initialized) {
      props.onInit?.();
      onInitCalled = true;
    }
  });

  createEffect(() => {
    if (!domNode) return;

    setStore(
      produce((store) => {
        store.width = domNode.clientWidth;
        store.height = domNode.clientHeight;
      }),
    );
  });

  createEffect(() => {
    if (props.paneClickDistance !== undefined) {
      setPaneClickDistance(props.paneClickDistance);
    }

    updateStore(setStore, {
      nodeTypes: props.nodeTypes,
      edgeTypes: props.edgeTypes,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      translateExtent: props.translateExtent,
    });
  });

  // Update store for simple changes where prop names equals store name
  createEffect(() => {
    updateStoreByKeys(setStore, {
      id: props.id ?? "1",
      connectionLineType: props.connectionLineType,
      connectionRadius: props.connectionRadius,
      selectionMode: props.selectionMode,
      snapGrid: props.snapGrid,
      defaultMarkerColor: props.defaultMarkerColor ?? "#b1b1b7",
      nodesDraggable: props.nodesDraggable,
      nodesConnectable: props.nodesConnectable,
      elementsSelectable: props.elementsSelectable,
      onlyRenderVisibleElements: props.onlyRenderVisibleElements,
      autoPanOnConnect: props.autoPanOnConnect,
      autoPanOnNodeDrag: props.autoPanOnNodeDrag,
      connectionMode: props.connectionMode ?? "strict",
      nodeDragThreshold: props.nodeDragThreshold,
      nodeOrigin: props.nodeOrigin,
      onError: props.onError,
      isValidConnection: props.isValidConnection,
      onDelete: props.onDelete,
      onEdgeCreate: props.onEdgeCreate,
      onConnect: props.onConnect,
      onConnectStart: props.onConnectStart,
      onConnectEnd: props.onConnectEnd,
      onBeforeDelete: props.onBeforeDelete,
    });
  });

  createEffect(() => {
    if (props.colorMode) {
      setColorModeClass(props.colorMode);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateColorMode = () => setColorModeClass(mediaQuery.matches ? "dark" : "light");

    updateColorMode();

    mediaQuery.addEventListener("change", updateColorMode);

    onCleanup(() => {
      mediaQuery.removeEventListener("change", updateColorMode);
    });
  });

  // Since we cannot pass generic type info at the point of context creation, we need to cast it here
  const SolidFlowProvider = (
    SolidFlowContext as unknown as Context<SolidFlowContextValue<NodeType, EdgeType>>
  ).Provider;

  return (
    <div
      ref={domNode}
      class={clsx(["xy-flow", "solid-flow", props.class, colorModeClass()])}
      style={props.style}
      data-testid="solid-flow__wrapper"
      role="application"
    >
      <SolidFlowProvider value={solidFlow}>
        <KeyHandler
          selectionKey={props.selectionKey}
          deleteKey={props.deleteKey}
          panActivationKey={props.panActivationKey}
          multiSelectionKey={props.multiSelectionKey}
          zoomActivationKey={props.zoomActivationKey}
        />
        <Zoom
          initialViewport={props.viewport || props.initialViewport}
          onMoveStart={props.onMoveStart}
          onMove={props.onMove}
          onMoveEnd={props.onMoveEnd}
          panOnScrollMode={props.panOnScrollMode ?? PanOnScrollMode.Free}
          preventScrolling={props.preventScrolling ?? true}
          zoomOnScroll={props.zoomOnScroll ?? true}
          zoomOnDoubleClick={props.zoomOnDoubleClick ?? true}
          zoomOnPinch={props.zoomOnPinch ?? true}
          panOnScroll={props.panOnScroll ?? false}
          panOnDrag={props.panOnDrag ?? true}
          paneClickDistance={props.paneClickDistance ?? 0}
        >
          <Pane
            onPaneClick={props.onPaneClick}
            onPaneContextMenu={props.onPaneContextMenu}
            panOnDrag={props.panOnDrag ?? true}
            selectionOnDrag={props.selectionOnDrag}
          >
            <Viewport>
              <EdgeRenderer
                onEdgeClick={props.onEdgeClick}
                onEdgeContextMenu={props.onEdgeContextMenu}
                onEdgeMouseEnter={props.onEdgeMouseEnter}
                onEdgeMouseLeave={props.onEdgeMouseLeave}
                defaultEdgeOptions={props.defaultEdgeOptions}
              />
              <ConnectionLine
                containerStyle={props.connectionLineContainerStyle}
                style={props.connectionLineStyle}
                isCustomComponent={Boolean(props.connectionLineContent)}
              >
                {props.connectionLineContent}
              </ConnectionLine>
              <div class="solid-flow__edgelabel-renderer" />
              <div class="solid-flow__viewport-portal" />
              <NodeRenderer
                nodeClickDistance={props.nodeClickDistance}
                onNodeClick={props.onNodeClick}
                onNodeMouseEnter={props.onNodeMouseEnter}
                onNodeMouseMove={props.onNodeMouseMove}
                onNodeMouseLeave={props.onNodeMouseLeave}
                onNodeDragStart={props.onNodeDragStart}
                onNodeDrag={props.onNodeDrag}
                onNodeDragStop={props.onNodeDragStop}
                onNodeContextMenu={props.onNodeContextMenu}
              />
              <NodeSelection
                onSelectionClick={props.onNodeSelectionClick}
                onSelectionContextMenu={props.onNodeSelectionContextMenu}
                onNodeDragStart={props.onNodeDragStart}
                onNodeDrag={props.onNodeDrag}
                onNodeDragStop={props.onNodeDragStop}
              />
            </Viewport>
            <UserSelection />
          </Pane>
        </Zoom>
        <Attribution proOptions={props.proOptions} position={props.attributionPosition} />
        {props.children}
      </SolidFlowProvider>
    </div>
  );
};

export default SolidFlow;
