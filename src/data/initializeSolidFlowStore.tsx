/* eslint-disable solid/reactivity */
import { ReactiveMap } from "@solid-primitives/map";
import {
  adoptUserNodes,
  type ConnectionLookup,
  type ConnectionState,
  createMarkerIds,
  devWarn,
  type EdgeLookup,
  getEdgePosition,
  getElevatedEdgeZIndex,
  getInternalNodesBounds,
  getNodesInside,
  getViewportForBounds,
  infiniteExtent,
  initialConnection,
  isEdgeVisible,
  type MarkerProps,
  type NodeLookup,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnError,
  type PanZoomInstance,
  type ParentLookup,
  pointToRendererPoint,
  type SelectionRect,
  updateConnectionLookup,
  type Viewport,
} from "@xyflow/system";
import { batch, mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

import {
  BezierEdgeInternal,
  SmoothStepEdgeInternal,
  StepEdgeInternal,
  StraightEdgeInternal,
} from "@/components/graph/edge";
import { DefaultNode, GroupNode, InputNode, OutputNode } from "@/components/graph/node";
import type { SolidFlowProps } from "@/components/SolidFlow/types";
import type {
  Edge,
  EdgeLayouted,
  EdgeTypes,
  FitViewOptions,
  InternalNode,
  Node,
  NodeTypes,
  OnBeforeDelete,
  OnDelete,
  OnEdgeCreate,
} from "@/shared/types";

import { getDefaultFlowStateProps } from "./utils";

type RefinedMarkerProps = Omit<MarkerProps, "markerUnits"> & {
  readonly markerUnits?: "strokeWidth" | "userSpaceOnUse" | undefined;
};

export const InitialNodeTypesMap = {
  input: InputNode,
  output: OutputNode,
  default: DefaultNode,
  group: GroupNode,
} satisfies NodeTypes;

export const InitialEdgeTypesMap = {
  straight: StraightEdgeInternal,
  smoothstep: SmoothStepEdgeInternal,
  default: BezierEdgeInternal,
  step: StepEdgeInternal,
} satisfies EdgeTypes;

export const initializeSolidFlowStore = <
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(
  props: Partial<SolidFlowProps<NodeType, EdgeType>>,
) => {
  const _props = mergeProps(getDefaultFlowStateProps<NodeType, EdgeType>(), props);

  const nodeLookup: NodeLookup<InternalNode<NodeType>> = new ReactiveMap();
  const parentLookup: ParentLookup<InternalNode<NodeType>> = new ReactiveMap();
  const edgeLookup: EdgeLookup<EdgeType> = new ReactiveMap();
  const connectionLookup: ConnectionLookup = new ReactiveMap();

  batch(() => {
    adoptUserNodes(_props.nodes, nodeLookup, parentLookup, {
      nodeExtent: _props.nodeExtent,
      nodeOrigin: _props.nodeOrigin,
      elevateNodesOnSelect: false,
      checkEquality: false,
    });

    updateConnectionLookup(connectionLookup, edgeLookup, _props.edges);
  });

  let viewport: Viewport = { x: 0, y: 0, zoom: 1 };

  if (_props.fitView && _props.width && _props.height) {
    const bounds = getInternalNodesBounds(nodeLookup, {
      filter: (node) =>
        Boolean((node.width || node.initialWidth) && (node.height || node.initialHeight)),
    });

    viewport = getViewportForBounds(
      bounds,
      _props.width,
      _props.height,
      _props.minZoom,
      _props.maxZoom,
      0.1,
    );
  }

  return createStore({
    id: _props.id,
    nodes: _props.nodes,
    edges: _props.edges,
    nodeTypes: InitialNodeTypesMap as NodeTypes,
    edgeTypes: InitialEdgeTypesMap as EdgeTypes,
    height: _props.height,
    width: _props.width,
    minZoom: _props.minZoom,
    maxZoom: _props.maxZoom,
    nodeLookup,
    parentLookup,
    edgeLookup,
    viewport,
    connectionLookup,
    elevateNodesOnSelect: _props.elevateNodesOnSelect,
    defaultEdgeOptions: _props.defaultEdgeOptions,
    defaultNodeOptions: _props.defaultNodeOptions,
    nodeOrigin: _props.nodeOrigin,
    nodeDragThreshold: _props.nodeDragThreshold,
    nodeExtent: _props.nodeExtent,
    translateExtent: infiniteExtent,
    autoPanOnNodeDrag: _props.autoPanOnNodeDrag,
    autoPanOnConnect: _props.autoPanOnConnect,
    snapGrid: _props.snapGrid,
    snapToGrid: _props.snapToGrid,
    selectionMode: _props.selectionMode,
    nodesDraggable: _props.nodesDraggable,
    nodesConnectable: _props.nodesConnectable,
    elementsSelectable: _props.elementsSelectable,
    selectNodesOnDrag: _props.selectNodesOnDrag,
    onlyRenderVisibleElements: _props.onlyRenderVisibleElements,
    defaultMarkerColor: _props.defaultMarkerColor,
    connectionMode: _props.connectionMode,
    connectionLineType: _props.connectionLineType,
    connectionRadius: _props.connectionRadius,
    connectionState: initialConnection as ConnectionState<InternalNode<NodeType>>,
    selectionRect: undefined as SelectionRect | undefined,
    selectionRectMode: undefined as string | undefined,
    domNode: null as HTMLDivElement | null,
    panZoom: null as PanZoomInstance | null,
    fitViewOptions: undefined as FitViewOptions | undefined,
    fitViewOnInit: false,
    fitViewOnInitDone: false,
    dragging: false,
    selectionKeyPressed: false,
    multiselectionKeyPressed: false,
    deleteKeyPressed: false,
    panActivationKeyPressed: false,
    zoomActivationKeyPressed: false,
    nodesInitialized: false,
    edgesInitialized: false,
    viewportInitialized: false,
    isValidConnection: (() => true) as () => boolean,
    onError: devWarn as OnError,
    onDelete: undefined as OnDelete | undefined,
    onEdgeCreate: undefined as OnEdgeCreate | undefined,
    onConnect: undefined as OnConnect | undefined,
    onConnectStart: undefined as OnConnectStart | undefined,
    onConnectEnd: undefined as OnConnectEnd | undefined,
    onBeforeDelete: undefined as OnBeforeDelete<NodeType, EdgeType> | undefined,

    // derived store values
    get lib() {
      return "solid" as const; // Made this a derived store get value to prevent overwriting the value
    },
    get initialized() {
      if (!this.nodes.length) return this.viewportInitialized;
      if (!this.edges.length) return this.viewportInitialized && this.nodesInitialized;
      return this.viewportInitialized && this.nodesInitialized && this.edgesInitialized;
    },
    get connection() {
      const state = this.connectionState;

      return {
        ...state,
        to: state.inProgress
          ? pointToRendererPoint(state.to, [this.viewport.x, this.viewport.y, this.viewport.zoom])
          : state.to,
      } as ConnectionState<InternalNode<NodeType>>;
    },
    get markers() {
      return createMarkerIds(this.edges, {
        defaultColor: this.defaultMarkerColor,
        id: this.id,
      }) as RefinedMarkerProps[];
    },
    get selectedNodes() {
      return this.nodes.filter((node) => node.selected);
    },
    get selectedEdges() {
      return this.edges.filter((edge) => edge.selected);
    },
    get visibleNodes() {
      const viewportNodes = getNodesInside(
        this.nodeLookup,
        { x: 0, y: 0, width: this.width, height: this.height },
        [this.viewport.x, this.viewport.y, this.viewport.zoom],
        true,
      );

      return this.onlyRenderVisibleElements ? viewportNodes : Array.from(this.nodeLookup.values());
    },
    get visibleEdges() {
      const filterVisibleEdges = Boolean(
        this.onlyRenderVisibleElements && this.width && this.height,
      );

      const edges = !filterVisibleEdges
        ? this.edges
        : this.edges.filter((edge) => {
            const sourceNode = this.nodeLookup.get(edge.source);
            const targetNode = this.nodeLookup.get(edge.target);

            return (
              sourceNode &&
              targetNode &&
              isEdgeVisible({
                sourceNode,
                targetNode,
                width: this.width,
                height: this.height,
                transform: [this.viewport.x, this.viewport.y, this.viewport.zoom],
              })
            );
          });

      const result = edges.reduce<EdgeLayouted[]>((res, edge) => {
        const sourceNode = this.nodeLookup.get(edge.source);
        const targetNode = this.nodeLookup.get(edge.target);

        if (!sourceNode || !targetNode) return res;

        const edgePosition = getEdgePosition({
          id: edge.id,
          sourceNode,
          sourceHandle: edge.sourceHandle ?? null,
          targetNode,
          targetHandle: edge.targetHandle ?? null,
          connectionMode: this.connectionMode,
          onError: this.onError,
        });

        if (edgePosition) {
          res.push({
            ...edge,
            zIndex: getElevatedEdgeZIndex({
              selected: edge.selected,
              zIndex: edge.zIndex,
              sourceNode,
              targetNode,
              elevateOnSelect: false,
            }),
            ...edgePosition,
          });
        }

        return res;
      }, []);

      return result;
    },
  });
};
