import type {
  Connection,
  CoordinateExtent,
  InternalNodeBase,
  InternalNodeUpdate,
  NodeDragItem,
  SetCenter,
  UpdateConnection,
  ViewportHelperFunctionOptions,
  XYPosition,
} from "@xyflow/system";
import type { SetStoreFunction, Store } from "solid-js/store";

import type { FitViewOptions } from "@/shared/types";
import type { Edge, Node } from "@/types";

import type { createSolidFlow } from "./createSolidFlow";

export type RequireProps<TSource extends object, TRequiredProps extends keyof TSource> = Omit<
  TSource,
  TRequiredProps
> &
  Required<Pick<TSource, TRequiredProps>>;

type Graph<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly nodes?: NodeType[];
  readonly edges?: EdgeType[];
};

export type SolidStore<T> = [get: Store<T>, set: SetStoreFunction<T>];

export type FlowStoreActions<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly addEdge: (edge: EdgeType | Connection) => void;
  readonly zoomIn: (options?: ViewportHelperFunctionOptions) => Promise<boolean>;
  readonly zoomOut: (options?: ViewportHelperFunctionOptions) => Promise<boolean>;
  readonly setMinZoom: (minZoom: number) => void;
  readonly setMaxZoom: (maxZoom: number) => void;
  readonly setTranslateExtent: (extent: CoordinateExtent) => void;
  readonly setPaneClickDistance: (distance: number) => void;
  readonly fitView: (options?: FitViewOptions) => Promise<boolean>;
  readonly setCenter: SetCenter;
  readonly updateNodePositions: (
    nodeDragItems: Map<string, NodeDragItem | InternalNodeBase<NodeType>>,
    dragging?: boolean,
  ) => void;
  readonly updateNodeInternals: (updates: Map<string, InternalNodeUpdate>) => void;
  readonly unselectNodesAndEdges: (params?: Graph<NodeType, EdgeType>) => void;
  readonly addSelectedNodes: (ids: string[]) => void;
  readonly addSelectedEdges: (ids: string[]) => void;
  readonly handleNodeSelection: (
    id: string,
    unselect?: boolean,
    nodeRef?: HTMLDivElement | null,
  ) => void;
  readonly handleEdgeSelection: (id: string) => void;
  readonly moveSelectedNodes: (direction: XYPosition, factor: number) => void;
  readonly panBy: (delta: XYPosition) => Promise<boolean>;
  readonly updateConnection: UpdateConnection;
  readonly cancelConnection: () => void;
  readonly reset: () => void;
};

export type SolidFlowStore<TNode extends Node, TEdge extends Edge> = ReturnType<
  typeof createSolidFlow<TNode, TEdge>
>;
