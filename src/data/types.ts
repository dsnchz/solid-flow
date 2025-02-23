import type {
  Connection,
  CoordinateExtent,
  InternalNodeUpdate,
  NodeOrigin,
  UpdateConnection,
  UpdateNodePositions,
  Viewport,
  ViewportHelperFunctionOptions,
  XYPosition,
} from "@xyflow/system";
import type { SetStoreFunction, Store } from "solid-js/store";

import type {
  DefaultEdgeOptions,
  DefaultNodeOptions,
  Edge,
  EdgeTypes,
  FitViewOptions,
  Node,
  NodeTypes,
} from "@/shared/types";

import type { createSolidFlow } from "./createSolidFlow";
import type { initializeSolidFlowStore } from "./initializeSolidFlowStore";

export type FlowStoreProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
  readonly viewport: Viewport;
  readonly defaultNodeOptions: DefaultNodeOptions;
  readonly defaultEdgeOptions: DefaultEdgeOptions;
  readonly width: number;
  readonly height: number;
  readonly fitView: boolean;
  readonly nodeOrigin: NodeOrigin;
  readonly nodeExtent: CoordinateExtent;
  readonly elevateNodesOnSelect: boolean;
};

type Graph = {
  readonly nodes: Node[];
  readonly edges: Edge[];
};

export type SolidStore<T> = [get: Store<T>, set: SetStoreFunction<T>];

type SolidFlowStore<NodeType extends Node, EdgeType extends Edge> = ReturnType<
  typeof initializeSolidFlowStore<NodeType, EdgeType>
>;
export type FlowStoreState<NodeType extends Node, EdgeType extends Edge> = SolidFlowStore<
  NodeType,
  EdgeType
>[0];
export type SolidFlowStoreSetter<NodeType extends Node, EdgeType extends Edge> = SolidFlowStore<
  NodeType,
  EdgeType
>[1];

type Handler<T, R = void> = (value: T) => R;
type OptionalHandler<T, R = void> = (value?: T) => R;

export type FlowStoreActions = {
  readonly syncViewport: (viewportStore?: SolidStore<Viewport>) => void;
  readonly setNodeTypes: Handler<NodeTypes>;
  readonly setEdgeTypes: Handler<EdgeTypes>;
  readonly addEdge: Handler<Edge | Connection>;
  readonly zoomIn: OptionalHandler<ViewportHelperFunctionOptions, Promise<boolean>>;
  readonly zoomOut: OptionalHandler<ViewportHelperFunctionOptions, Promise<boolean>>;
  readonly setMinZoom: Handler<number>;
  readonly setMaxZoom: Handler<number>;
  readonly setTranslateExtent: Handler<CoordinateExtent>;
  readonly setPaneClickDistance: Handler<number>;
  readonly fitView: OptionalHandler<FitViewOptions, Promise<boolean>>;
  readonly updateNodePositions: UpdateNodePositions;
  readonly updateNodeInternals: Handler<Map<string, InternalNodeUpdate>>;
  readonly unselectNodesAndEdges: OptionalHandler<Partial<Graph>>;
  readonly addSelectedNodes: Handler<string[]>;
  readonly addSelectedEdges: Handler<string[]>;
  readonly handleNodeSelection: Handler<string>;
  readonly panBy: Handler<XYPosition, Promise<boolean>>;
  readonly updateConnection: UpdateConnection;
  readonly cancelConnection: () => void;
  readonly reset: () => void;
};

export type FlowStore<NodeType extends Node, EdgeType extends Edge> = ReturnType<
  typeof createSolidFlow<NodeType, EdgeType>
>;
export type FlowStoreSetter<NodeType extends Node, EdgeType extends Edge> = SolidFlowStore<
  NodeType,
  EdgeType
>[1];
