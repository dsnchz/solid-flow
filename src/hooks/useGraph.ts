import type { Viewport } from "@xyflow/system";
import type { Accessor } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import type { Edge, Node } from "@/types";

/**
 * Hook for getting the current nodes from the store.
 *
 * @public
 * @returns store with an array of nodes
 */
export function useNodes<NodeType extends Node = Node>(): Accessor<readonly NodeType[]> {
  const { flow } = useInternalSolidFlow<NodeType>();
  return () => flow.nodes;
}

/**
 * Hook for getting the current edges from the store.
 *
 * @public
 * @returns store with an array of edges
 */
export function useEdges<EdgeType extends Edge = Edge>(): Accessor<readonly EdgeType[]> {
  const { flow } = useInternalSolidFlow<Node, EdgeType>();
  return () => flow.edges;
}

/**
 * Hook for getting the current viewport from the store.
 *
 * @public
 * @returns store with the viewport object
 */
export function useViewport(): Accessor<Viewport> {
  const { flow } = useInternalSolidFlow();
  return () => flow.viewport;
}

/**
 * Reactive lookup of one node by id (xyflow#5868 parity). Returns the USER
 * node row — for measured geometry use {@link useInternalNode}.
 */
export function useNode<NodeType extends Node = Node>(
  id: Accessor<string>,
): Accessor<NodeType | undefined> {
  const { flow } = useInternalSolidFlow<NodeType>();
  return () => flow.nodes.find((node) => node.id === id());
}

/** Reactive lookup of one edge by id (xyflow#5868 parity). */
export function useEdge<EdgeType extends Edge = Edge>(
  id: Accessor<string>,
): Accessor<EdgeType | undefined> {
  const { flow } = useInternalSolidFlow<Node, EdgeType>();
  return () => flow.edges.find((edge) => edge.id === id());
}

/** The currently selected nodes, reactively (xyflow#5868 parity). */
export function useSelectedNodes<NodeType extends Node = Node>(): Accessor<readonly NodeType[]> {
  const { flow } = useInternalSolidFlow<NodeType>();
  return () => flow.selection.nodes;
}

/** The currently selected edges, reactively (xyflow#5868 parity). */
export function useSelectedEdges<EdgeType extends Edge = Edge>(): Accessor<readonly EdgeType[]> {
  const { flow } = useInternalSolidFlow<Node, EdgeType>();
  return () => flow.selection.edges;
}
