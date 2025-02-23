/* eslint-disable solid/reactivity */
import {
  adoptUserNodes,
  ConnectionLineType,
  type ConnectionLookup,
  type ConnectionMode,
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
  type NodeOrigin,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnError,
  type PanZoomInstance,
  type ParentLookup,
  pointToRendererPoint,
  SelectionMode,
  type SelectionRect,
  type SnapGrid,
  type Transform,
  updateConnectionLookup,
  type Viewport,
} from "@xyflow/system";
import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

import {
  BezierEdgeInternal,
  SmoothStepEdgeInternal,
  StepEdgeInternal,
  StraightEdgeInternal,
} from "@/components/graph/edge";
import { DefaultNode, GroupNode, InputNode, OutputNode } from "@/components/graph/node";
import type {
  DefaultEdgeOptions,
  DefaultNodeOptions,
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

import type { FlowStoreProps } from "./types";

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
  props: Partial<FlowStoreProps<NodeType, EdgeType>>,
) => {
  const _props = mergeProps(
    {
      nodes: [] as NodeType[],
      edges: [] as EdgeType[],
      fitView: false,
      nodeOrigin: [0, 0] as NodeOrigin,
      nodeExtent: infiniteExtent,
      elevateNodesOnSelect: false,
      defaultNodeOptions: {} as DefaultNodeOptions,
      defaultEdgeOptions: {} as DefaultEdgeOptions,
    },
    props,
  );

  const nodeLookup: NodeLookup<InternalNode<NodeType>> = new Map();
  const parentLookup: ParentLookup<InternalNode<NodeType>> = new Map();
  const connectionLookup: ConnectionLookup = new Map();
  const edgeLookup: EdgeLookup<EdgeType> = new Map();

  adoptUserNodes(_props.nodes, nodeLookup, parentLookup, {
    nodeExtent: _props.nodeExtent,
    nodeOrigin: _props.nodeOrigin,
    elevateNodesOnSelect: false,
    checkEquality: false,
  });

  updateConnectionLookup(connectionLookup, edgeLookup, _props.edges);

  let viewport: Viewport = { x: 0, y: 0, zoom: 1 };

  if (_props.fitView && _props.width && _props.height) {
    const bounds = getInternalNodesBounds(nodeLookup, {
      filter: (node) =>
        !!((node.width || node.initialWidth) && (node.height || node.initialHeight)),
    });
    viewport = getViewportForBounds(bounds, _props.width, _props.height, 0.5, 2, 0.1);
  }

  return createStore({
    id: null as string | null,
    nodes: _props.nodes,
    edges: _props.edges,
    nodeTypes: InitialNodeTypesMap as NodeTypes,
    edgeTypes: InitialEdgeTypesMap as EdgeTypes,
    nodesInitialized: false,
    edgesInitialized: false,
    viewportInitialized: false,
    height: 500,
    width: 500,
    minZoom: 0.5,
    maxZoom: 2,
    nodeLookup,
    parentLookup,
    edgeLookup,
    elevateNodesOnSelect: _props.elevateNodesOnSelect,
    defaultEdgeOptions: _props.defaultEdgeOptions,
    defaultNodeOptions: _props.defaultNodeOptions,
    connectionLookup,
    nodeOrigin: _props.nodeOrigin,
    nodeDragThreshold: 1,
    nodeExtent: _props.nodeExtent,
    translateExtent: infiniteExtent,
    autoPanOnNodeDrag: true,
    autoPanOnConnect: true,
    fitViewOnInit: false,
    fitViewOnInitDone: false,
    fitViewOptions: undefined as FitViewOptions | undefined,
    panZoom: null as PanZoomInstance | null,
    snapGrid: null as SnapGrid | null,
    dragging: false,
    selectionMode: SelectionMode.Partial,
    selectionRect: null as SelectionRect | null,
    selectionRectMode: null as string | null,
    selectionKeyPressed: false,
    multiselectionKeyPressed: false,
    deleteKeyPressed: false,
    panActivationKeyPressed: false,
    zoomActivationKeyPressed: false,
    viewport,
    connectionMode: "strict" as ConnectionMode,
    domNode: null as HTMLDivElement | null,
    connectionState: initialConnection as ConnectionState,
    connectionLineType: ConnectionLineType.Bezier,
    connectionRadius: 20,
    nodesDraggable: true,
    nodesConnectable: true,
    elementsSelectable: true,
    selectNodesOnDrag: true,
    onlyRenderVisibleElements: false,
    lib: "solid",
    defaultMarkerColor: "#b1b1b7",
    isValidConnection: (() => true) as () => boolean,
    onError: devWarn as OnError,
    onDelete: undefined as OnDelete | undefined,
    onEdgeCreate: undefined as OnEdgeCreate | undefined,
    onConnect: undefined as OnConnect | undefined,
    onConnectStart: undefined as OnConnectStart | undefined,
    onConnectEnd: undefined as OnConnectEnd | undefined,
    onBeforeDelete: undefined as OnBeforeDelete<NodeType, EdgeType> | undefined,

    // derived store values
    get initialized() {
      if (!this.nodes.length) return this.viewportInitialized;
      if (!this.edges.length) return this.viewportInitialized && this.nodesInitialized;
      return this.viewportInitialized && this.nodesInitialized && this.edgesInitialized;
    },
    get connection() {
      const state = this.connectionState;

      return state.inProgress
        ? {
            ...state,
            to: pointToRendererPoint(state.to, [
              this.viewport.x,
              this.viewport.y,
              this.viewport.zoom,
            ]),
          }
        : { ...state };
    },
    get markers() {
      return createMarkerIds(this.edges, {
        defaultColor: this.defaultMarkerColor,
        id: this.id,
      }) as RefinedMarkerProps[];
    },
    get visibleNodes() {
      const transform: Transform = [this.viewport.x, this.viewport.y, this.viewport.zoom];

      return (
        this.onlyRenderVisibleElements
          ? getNodesInside(
              this.nodeLookup,
              { x: 0, y: 0, width: this.width, height: this.height },
              transform,
              true,
            )
          : Array.from(this.nodeLookup.values())
      ) as InternalNode<NodeType>[];
    },
    get selectedNodes() {
      return this.nodes.filter((node) => node.selected);
    },
    get selectedEdges() {
      return this.edges.filter((edge) => edge.selected);
    },
    get visibleEdges() {
      const edges =
        this.onlyRenderVisibleElements && this.width && this.height
          ? this.edges.filter((edge) => {
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
            })
          : this.edges;

      return edges.reduce<EdgeLayouted[]>((res, edge) => {
        const sourceNode = this.nodeLookup.get(edge.source);
        const targetNode = this.nodeLookup.get(edge.target);

        if (!sourceNode || !targetNode) return res;

        const edgePosition = getEdgePosition({
          id: edge.id,
          sourceNode,
          targetNode,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
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
    },
  });
};
