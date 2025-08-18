import { useInternalSolidFlow } from "@/components/contexts";
import type { Edge, Node } from "@/types";

/**
 * Hook for getting the current nodes from the store.
 *
 * @public
 * @returns store with an array of nodes
 */
export function useNodes<NodeType extends Node = Node>() {
  const { store } = useInternalSolidFlow<NodeType>();
  return () => store.nodes;
}

/**
 * Hook for getting the current edges from the store.
 *
 * @public
 * @returns store with an array of edges
 */
export function useEdges<EdgeType extends Edge = Edge>() {
  const { store } = useInternalSolidFlow<Node, EdgeType>();
  return () => store.edges;
}

/**
 * Hook for getting the current viewport from the store.
 *
 * @public
 * @returns store with the viewport object
 */
export function useViewport() {
  const { store } = useInternalSolidFlow();
  return () => store.viewport;
}
