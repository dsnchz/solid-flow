import type { Edge, InternalNode, Node } from "@/types";

import type { FlowSelection, FlowState } from "./flowState";
import type { ConnectionsRecord } from "./projections/connections";

/** The store keys the read surface forwards (the store satisfies it). */
export type FlowReadSource<NodeType extends Node = Node, EdgeType extends Edge = Edge> = Omit<
  FlowState<NodeType, EdgeType>,
  "internalNodes" | "connections" | "selection"
> & {
  readonly selectedNodes: readonly NodeType[];
  readonly selectedEdges: readonly EdgeType[];
};

/**
 * The public read surface: the whole data graph as ONE reactive struct.
 * `flow` and `flow.selection` are stable identities — reactivity lives
 * inside the property reads, each forwarded to the store — so consumers can
 * destructure them safely.
 */
export const createFlowReadSurface = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  store: FlowReadSource<NodeType, EdgeType>,
  internalNodes: Record<string, InternalNode<NodeType>>,
  connections: ConnectionsRecord,
): FlowState<NodeType, EdgeType> => {
  const selection: FlowSelection<NodeType, EdgeType> = {
    get nodes() {
      return store.selectedNodes;
    },
    get edges() {
      return store.selectedEdges;
    },
  };

  return {
    get nodes() {
      return store.nodes;
    },
    get edges() {
      return store.edges;
    },
    internalNodes,
    connections,
    selection,
    get nodesInitialized() {
      return store.nodesInitialized;
    },
    get viewportInitialized() {
      return store.viewportInitialized;
    },
    get viewport() {
      return store.viewport;
    },
    get width() {
      return store.width;
    },
    get height() {
      return store.height;
    },
    get connection() {
      return store.connection;
    },
    get dragging() {
      return store.dragging;
    },
    get minZoom() {
      return store.minZoom;
    },
    get maxZoom() {
      return store.maxZoom;
    },
    get nodesDraggable() {
      return store.nodesDraggable;
    },
    get nodesConnectable() {
      return store.nodesConnectable;
    },
    get elementsSelectable() {
      return store.elementsSelectable;
    },
    get snapGrid() {
      return store.snapGrid;
    },
  };
};
