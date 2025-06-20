/* eslint-disable solid/reactivity */
import { ReactiveMap } from "@solid-primitives/map";
import { createMediaQuery } from "@solid-primitives/media";
import {
  adoptUserNodes,
  type ConnectionLookup,
  type ConnectionState,
  createMarkerIds,
  devWarn,
  type EdgeLookup,
  fitViewport,
  getInternalNodesBounds,
  getViewportForBounds,
  type Handle,
  infiniteExtent,
  initialConnection,
  type MarkerProps,
  mergeAriaLabelConfig,
  type NodeLookup,
  type OnError,
  type PanZoomInstance,
  type ParentLookup,
  pointToRendererPoint,
  type SelectionRect,
  type Transform,
  updateConnectionLookup,
  type Viewport,
} from "@xyflow/system";
import { batch, mergeProps } from "solid-js";
import { createStore, produce } from "solid-js/store";

import {
  BezierEdgeInternal,
  SmoothStepEdgeInternal,
  StepEdgeInternal,
  StraightEdgeInternal,
} from "@/components/graph/edge";
import { DefaultNode, GroupNode, InputNode, OutputNode } from "@/components/graph/node";
import type { SolidFlowProps } from "@/components/SolidFlow/types";
import type {
  BuiltInEdgeTypes,
  BuiltInNodeTypes,
  Edge,
  EdgeTypes,
  InternalNode,
  Node,
  NodeTypes,
} from "@/types";

import { getDefaultFlowStateProps } from "./defaults";

type RefinedMarkerProps = Omit<MarkerProps, "markerUnits"> & {
  readonly markerUnits?: "strokeWidth" | "userSpaceOnUse" | undefined;
};

const getInitialViewport = (
  // This is just used to make sure adoptUserNodes is called before we calculate the viewport
  _nodesInitialized: boolean,
  fitView: boolean | undefined,
  initialViewport: Viewport | undefined,
  width: number,
  height: number,
  nodeLookup: NodeLookup,
) => {
  if (fitView && !initialViewport && width && height) {
    const bounds = getInternalNodesBounds(nodeLookup, {
      filter: (node) =>
        !!((node.width || node.initialWidth) && (node.height || node.initialHeight)),
    });
    return getViewportForBounds(bounds, width, height, 0.5, 2, 0.1);
  } else {
    return initialViewport ?? { x: 0, y: 0, zoom: 1 };
  }
};

export const InitialNodeTypesMap = {
  input: InputNode,
  output: OutputNode,
  default: DefaultNode,
  group: GroupNode,
} satisfies BuiltInNodeTypes;

export const InitialEdgeTypesMap = {
  straight: StraightEdgeInternal,
  smoothstep: SmoothStepEdgeInternal,
  default: BezierEdgeInternal,
  step: StepEdgeInternal,
} satisfies BuiltInEdgeTypes;

export const initializeSolidFlowStore = <
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(
  props: SolidFlowProps<NodeType, EdgeType>,
) => {
  const _props = mergeProps(getDefaultFlowStateProps<NodeType, EdgeType>(), props);

  const nodeLookup: NodeLookup<InternalNode<NodeType>> = new ReactiveMap();
  const parentLookup: ParentLookup<InternalNode<NodeType>> = new ReactiveMap();
  const edgeLookup: EdgeLookup<EdgeType> = new ReactiveMap();
  const connectionLookup: ConnectionLookup = new ReactiveMap();

  batch(() => {
    updateConnectionLookup(connectionLookup, edgeLookup, _props.edges);
  });

  const startNodesInitialized = batch(() => {
    return adoptUserNodes(_props.nodes, nodeLookup, parentLookup, {
      nodeExtent: _props.nodeExtent,
      nodeOrigin: _props.nodeOrigin,
      elevateNodesOnSelect: _props.elevateNodesOnSelect,
      checkEquality: true,
    });
  });

  const _viewport = getInitialViewport(
    startNodesInitialized,
    _props.fitView,
    _props.initialViewport,
    _props.width ?? 0,
    _props.height ?? 0,
    nodeLookup,
  );

  const mediaPrefersDark = createMediaQuery(
    "(prefers-color-scheme: dark)",
    _props.colorModeSSR === "dark",
  );

  const [store, setStore] = createStore({
    id: _props.id,

    // "Pseduo-private" props
    _colorMode: _props.colorMode,
    _colorModeSSR: _props.colorModeSSR,
    _connection: { ...initialConnection } as ConnectionState<InternalNode<NodeType>>,
    _nodeTypes: _props.nodeTypes,
    _edgeTypes: _props.edgeTypes,

    nodes: _props.nodes,
    edges: _props.edges,

    height: _props.height ?? 0,
    width: _props.width ?? 0,
    minZoom: _props.minZoom,
    maxZoom: _props.maxZoom,
    viewport: _props.viewport ?? _viewport,

    autoPanSpeed: _props.autoPanSpeed,
    elevateNodesOnSelect: _props.elevateNodesOnSelect,
    defaultEdgeOptions: _props.defaultEdgeOptions,
    defaultNodeOptions: _props.defaultNodeOptions,
    nodeOrigin: _props.nodeOrigin,
    nodeDragThreshold: _props.nodeDragThreshold,
    nodeExtent: _props.nodeExtent,
    translateExtent: infiniteExtent,

    fitViewResolver: undefined as PromiseWithResolvers<boolean> | undefined,
    snapGrid: _props.snapGrid,
    selectionMode: _props.selectionMode,
    nodesDraggable: _props.nodesDraggable,
    nodesFocusable: _props.nodesFocusable,
    nodesConnectable: _props.nodesConnectable,
    edgesFocusable: _props.edgesFocusable,
    elementsSelectable: _props.elementsSelectable,
    selectNodesOnDrag: _props.selectNodesOnDrag,
    onlyRenderVisibleElements: _props.onlyRenderVisibleElements,
    defaultMarkerColor: _props.defaultMarkerColor,
    connectionMode: _props.connectionMode,
    connectionLineType: _props.connectionLineType,
    connectionRadius: _props.connectionRadius,
    selectionRect: undefined as SelectionRect | undefined,
    selectionRectMode: undefined as string | undefined,
    domNode: null as HTMLDivElement | null,
    panZoom: null as PanZoomInstance | null,
    fitViewQueued: _props.fitView,
    fitViewOptions: _props.fitViewOptions,
    fitViewOnInit: false,
    fitViewOnInitDone: false,
    dragging: false,
    selectionKeyPressed: false,
    multiselectionKeyPressed: false,
    deleteKeyPressed: false,
    panActivationKeyPressed: false,
    zoomActivationKeyPressed: false,
    elevateEdgesOnSelect: _props.elevateEdgesOnSelect,
    disableKeyboardA11y: _props.disableKeyboardA11y,
    autoPanOnNodeDrag: _props.autoPanOnNodeDrag,
    autoPanOnConnect: _props.autoPanOnConnect,
    autoPanOnNodeFocus: _props.autoPanOnNodeFocus,
    noPanClass: _props.noPanClass,
    noDragClass: _props.noDragClass,
    noWheelClass: _props.noWheelClass,
    ariaLiveMessage: _props.ariaLiveMessage,
    ariaLabelConfig: mergeAriaLabelConfig(_props.ariaLabelConfig),

    isValidConnection: _props.isValidConnection ?? (() => true),

    onError: _props.onFlowError ?? (devWarn as OnError),

    onDelete: _props.onDelete,
    onBeforeDelete: _props.onBeforeDelete,

    onBeforeConnect: _props.onBeforeConnect,
    onConnect: _props.onConnect,
    onConnectStart: _props.onConnectStart,
    onConnectEnd: _props.onConnectEnd,

    onBeforeReconnect: _props.onBeforeReconnect,
    onReconnect: _props.onReconnect,
    onReconnectStart: _props.onReconnectStart,
    onReconnectEnd: _props.onReconnectEnd,

    clickConnect: _props.clickConnect ?? true,
    onClickConnectStart: _props.onClickConnectStart,
    onClickConnectEnd: _props.onClickConnectEnd,
    clickConnectStartHandle: undefined as Pick<Handle, "id" | "nodeId" | "type"> | undefined,

    onSelectionDrag: _props.onSelectionDrag,
    onSelectionDragStart: _props.onSelectionDragStart,
    onSelectionDragStop: _props.onSelectionDragStop,

    // derived store values
    get lib() {
      /*
       * Made this a derived store get value to prevent overwriting the value. This value is crucial
       * for the underlying @xyflow/system library to identify elements as this is the prefix we use
       * for all the CSS class names across the library.
       */
      return "solid" as const;
    },
    get selectedNodes() {
      return this.nodes.filter((node) => node.selected);
    },
    get selectedEdges() {
      return this.edges.filter((edge) => edge.selected);
    },
    get viewportInitialized() {
      return this.panZoom !== null;
    },
    get transform() {
      return [this.viewport.x, this.viewport.y, this.viewport.zoom] as Transform;
    },
    get nodeTypes() {
      return { ...InitialNodeTypesMap, ...this._nodeTypes } as NodeTypes;
    },
    get edgeTypes() {
      return { ...InitialEdgeTypesMap, ...this._edgeTypes } as EdgeTypes;
    },
    get colorMode() {
      return this._colorMode === "system"
        ? mediaPrefersDark()
          ? "dark"
          : "light"
        : this._colorMode;
    },
    get connection() {
      const state = this._connection;

      return {
        ...state,
        to: state.inProgress ? pointToRendererPoint(state.to, this.transform) : state.to,
      } as ConnectionState<InternalNode<NodeType>>;
    },
    get markers() {
      return createMarkerIds(this.edges, {
        defaultColor: this.defaultMarkerColor,
        id: this.id,
      }) as RefinedMarkerProps[];
    },
  });

  const resolveFitView = async () => {
    if (!store.panZoom) return;

    await fitViewport(
      {
        nodes: nodeLookup,
        width: store.width,
        height: store.height,
        panZoom: store.panZoom,
        minZoom: store.minZoom,
        maxZoom: store.maxZoom,
      },
      store.fitViewOptions,
    );

    store.fitViewResolver?.resolve(true);

    /**
     * wait for the fitViewport to resolve before deleting the resolver,
     * we want to reuse the old resolver if the user calls fitView again in the mean time
     */
    setStore(
      produce((store) => {
        store.fitViewQueued = false;
        store.fitViewOptions = undefined;
        store.fitViewResolver = undefined;
      }),
    );
  };

  const updateSystemNodes = () => {
    return batch(() => {
      return adoptUserNodes(store.nodes, nodeLookup, parentLookup, {
        nodeOrigin: store.nodeOrigin,
        nodeExtent: store.nodeExtent,
        elevateNodesOnSelect: store.elevateNodesOnSelect,
        checkEquality: false, // recompute internal nodes
      });
    });
  };

  const nodesInitialized = () => {
    const result = updateSystemNodes();

    if (store.fitViewQueued) {
      if (store.fitViewOptions?.duration) {
        void resolveFitView();
      } else {
        queueMicrotask(() => {
          void resolveFitView();
        });
      }
    }

    return result;
  };

  const resetStoreValues = () => {
    setStore(
      produce((store) => {
        store.dragging = false;
        store.selectionRect = undefined;
        store.selectionRectMode = undefined;
        store.selectionKeyPressed = false;
        store.multiselectionKeyPressed = false;
        store.deleteKeyPressed = false;
        store.panActivationKeyPressed = false;
        store.zoomActivationKeyPressed = false;
        store._connection = { ...initialConnection };
        store.clickConnectStartHandle = undefined;
        store.viewport = _props.initialViewport ?? { x: 0, y: 0, zoom: 1 };
        store.ariaLiveMessage = "";
        store.snapGrid = undefined;
      }),
    );
  };

  return {
    store,
    nodeLookup,
    parentLookup,
    edgeLookup,
    connectionLookup,
    setStore,
    nodesInitialized,
    resolveFitView,
    updateSystemNodes,
    resetStoreValues,
  } as const;
};
