import { useFlowStore } from "@/components/contexts";

/**
 * Hook for getting the current nodes from the store.
 *
 * @public
 * @returns store with an array of nodes
 */
export function useNodes() {
  const { store } = useFlowStore();
  return store.nodes;
}

/**
 * Hook for getting the current edges from the store.
 *
 * @public
 * @returns store with an array of edges
 */
export function useEdges() {
  const { store } = useFlowStore();
  return store.edges;
}
