import { type ColorModeClass, infiniteExtent, isMacOs } from "@xyflow/system";
import clsx from "clsx";
import {
  type Context,
  createEffect,
  type JSX,
  mergeProps,
  onCleanup,
  onMount,
  type ParentProps,
  useContext,
} from "solid-js";
import { produce } from "solid-js/store";

import { EdgeRenderer, NodeRenderer, Pane, Viewport, Zoom } from "@/components/container";
import { ConnectionLine } from "@/components/graph/connection";
import { NodeSelection, UserSelection } from "@/components/graph/selection";
import { Attribution, KeyHandler } from "@/components/utility";
import { createSolidFlow } from "@/data/createSolidFlow";
import { getDefaultFlowStateProps } from "@/data/utils";
import { setColorModeClass } from "@/shared/signals/colorModeClass";
import { colorModeClass } from "@/shared/signals/colorModeClass";
import type { Edge, Node, PanOnScrollMode } from "@/shared/types";

import { SolidFlowContext, type SolidFlowContextValue } from "../contexts/flow";
import type { SolidFlowProps } from "./types";
import { updateStore, updateStoreByKeys } from "./utils";

const SolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<Partial<SolidFlowProps<NodeType, EdgeType>>>,
) => {
  const _props = mergeProps(
    {
      ...getDefaultFlowStateProps<NodeType, EdgeType>(),
      colorMode: "light" as ColorModeClass,
      deleteKeyCode: "Backspace",
      defaultViewport: { x: 0, y: 0, zoom: 1 },
      multiSelectionKeyCode: isMacOs() ? "Meta" : "Control",
      noDragClassName: "nodrag",
      noPanClassName: "nopan",
      noWheelClassName: "nowheel",
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

  let domNode!: HTMLDivElement;

  // Since we cannot pass generic types info at the point of context creation, we need to cast it here
  const TypedSolidFlowContext = SolidFlowContext as unknown as Context<
    SolidFlowContextValue<NodeType, EdgeType>
  >;

  // User can wrap SolidFlow with an outer context provider to provide custom context values
  const solidFlow = useContext(TypedSolidFlowContext) ?? createSolidFlow(_props);
  const { store, reset, setStore, setPaneClickDistance } = solidFlow;

  onMount(() => {
    setStore(
      produce((store) => {
        store.domNode = domNode;
        store.width = domNode.clientWidth;
        store.height = domNode.clientHeight;
      }),
    );

    if (_props.paneClickDistance !== undefined) {
      setPaneClickDistance(_props.paneClickDistance);
    }

    if (_props.fitView !== undefined) {
      setStore("fitViewOnInit", _props.fitView);
    }

    if (_props.fitViewOptions !== undefined) {
      setStore("fitViewOptions", _props.fitViewOptions);
    }

    updateStore(setStore, {
      nodeTypes: _props.nodeTypes,
      edgeTypes: _props.edgeTypes,
      minZoom: _props.minZoom,
      maxZoom: _props.maxZoom,
      translateExtent: _props.translateExtent,
    });

    onCleanup(() => {
      reset();
    });
  });

  // Call oninit once when flow is initialized
  let onInitCalled = false;
  createEffect(() => {
    if (!onInitCalled && store.initialized) {
      _props.onInit?.();
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
    if (_props.paneClickDistance !== undefined) {
      setPaneClickDistance(_props.paneClickDistance);
    }

    updateStore(setStore, {
      nodeTypes: _props.nodeTypes,
      edgeTypes: _props.edgeTypes,
      minZoom: _props.minZoom,
      maxZoom: _props.maxZoom,
      translateExtent: _props.translateExtent,
    });
  });

  // Update store for simple changes where prop names equals store name
  createEffect(() => {
    updateStoreByKeys(setStore, {
      id: _props.id,
      connectionLineType: _props.connectionLineType,
      connectionRadius: _props.connectionRadius,
      selectionMode: _props.selectionMode,
      snapGrid: _props.snapGrid,
      defaultMarkerColor: _props.defaultMarkerColor,
      nodesDraggable: _props.nodesDraggable,
      nodesConnectable: _props.nodesConnectable,
      elementsSelectable: _props.elementsSelectable,
      onlyRenderVisibleElements: _props.onlyRenderVisibleElements,
      autoPanOnConnect: _props.autoPanOnConnect,
      autoPanOnNodeDrag: _props.autoPanOnNodeDrag,
      connectionMode: _props.connectionMode,
      nodeDragThreshold: _props.nodeDragThreshold,
      nodeOrigin: _props.nodeOrigin,
      onError: _props.onError,
      isValidConnection: _props.isValidConnection,
      onDelete: _props.onDelete,
      onEdgeCreate: _props.onEdgeCreate,
      onConnect: _props.onConnect,
      onConnectStart: _props.onConnectStart,
      onConnectEnd: _props.onConnectEnd,
      onBeforeDelete: _props.onBeforeDelete,
    });
  });

  createEffect(() => {
    if (_props.colorMode) {
      setColorModeClass(_props.colorMode);
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

  const onScroll: JSX.EventHandler<HTMLDivElement, Event> = (e) => {
    e.currentTarget.scrollTo({ top: 0, left: 0, behavior: "instant" });
    onScroll?.(e);
  };

  const style = () =>
    ({
      width: "100%",
      height: "100%",
      overflow: "hidden",
      position: "relative",
      "z-index": 0,
      ...(_props.style ?? {}),
    }) as const;

  return (
    <div
      role="application"
      ref={domNode}
      data-testid="solid-flow__wrapper"
      class={clsx(["xy-flow", "solid-flow", _props.class, colorModeClass()])}
      style={style()}
      onScroll={onScroll}
    >
      <TypedSolidFlowContext.Provider value={solidFlow}>
        <KeyHandler
          selectionKey={_props.selectionKey}
          deleteKey={_props.deleteKey}
          panActivationKey={_props.panActivationKey}
          multiSelectionKey={_props.multiSelectionKey}
          zoomActivationKey={_props.zoomActivationKey}
        />
        <Zoom
          initialViewport={_props.viewport || _props.initialViewport}
          onMoveStart={_props.onMoveStart}
          onMove={_props.onMove}
          onMoveEnd={_props.onMoveEnd}
          panOnScrollMode={_props.panOnScrollMode}
          preventScrolling={_props.preventScrolling}
          zoomOnScroll={_props.zoomOnScroll}
          zoomOnDoubleClick={_props.zoomOnDoubleClick}
          zoomOnPinch={_props.zoomOnPinch}
          panOnScroll={_props.panOnScroll}
          panOnDrag={_props.panOnDrag}
          paneClickDistance={_props.paneClickDistance}
        >
          <Pane
            onPaneClick={_props.onPaneClick}
            onPaneContextMenu={_props.onPaneContextMenu}
            panOnDrag={_props.panOnDrag}
            selectionOnDrag={_props.selectionOnDrag}
          >
            <Viewport>
              <EdgeRenderer<NodeType, EdgeType>
                reconnectRadius={_props.reconnectRadius}
                onEdgeClick={_props.onEdgeClick}
                onEdgeContextMenu={_props.onEdgeContextMenu}
                onEdgeMouseEnter={_props.onEdgeMouseEnter}
                onEdgeMouseLeave={_props.onEdgeMouseLeave}
                defaultEdgeOptions={_props.defaultEdgeOptions}
              />
              <ConnectionLine<NodeType>
                component={_props.connectionLineComponent}
                containerStyle={_props.connectionLineContainerStyle}
                style={_props.connectionLineStyle}
              />
              <div class="solid-flow__container solid-flow__edgelabel-renderer" />
              <div class="solid-flow__container solid-flow__viewport-portal" />
              <NodeRenderer
                nodeClickDistance={_props.nodeClickDistance}
                onNodeClick={_props.onNodeClick}
                onNodeMouseEnter={_props.onNodeMouseEnter}
                onNodeMouseMove={_props.onNodeMouseMove}
                onNodeMouseLeave={_props.onNodeMouseLeave}
                onNodeDragStart={_props.onNodeDragStart}
                onNodeDrag={_props.onNodeDrag}
                onNodeDragStop={_props.onNodeDragStop}
                onNodeContextMenu={_props.onNodeContextMenu}
              />
              <NodeSelection
                onSelectionClick={_props.onNodeSelectionClick}
                onSelectionContextMenu={_props.onNodeSelectionContextMenu}
                onNodeDragStart={_props.onNodeDragStart}
                onNodeDrag={_props.onNodeDrag}
                onNodeDragStop={_props.onNodeDragStop}
              />
            </Viewport>
            <UserSelection />
          </Pane>
        </Zoom>
        <Attribution proOptions={_props.proOptions} position={_props.attributionPosition} />
        {_props.children}
      </TypedSolidFlowContext.Provider>
    </div>
  );
};

export default SolidFlow;
