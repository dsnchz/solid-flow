import { useInternalSolidFlow } from "@/components/contexts";

/**
 * Hook for getting the current nodes from the store.
 *
 * @public
 * @returns store with an array of nodes
 */
export function useNodes() {
  const { store } = useInternalSolidFlow();
  return () => store.nodes;
}

/**
 * Hook for getting the current edges from the store.
 *
 * @public
 * @returns store with an array of edges
 */
export function useEdges() {
  const { store } = useInternalSolidFlow();
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
