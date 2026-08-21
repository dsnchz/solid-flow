import { useInternalSolidFlow } from "~/components/contexts";

/**
 * Hook for seeing if all nodes have been measured.
 *
 * Returns `false` until every non-hidden node has been rendered and measured.
 * Useful for running layouting or fitView logic that depends on node dimensions.
 *
 * @public
 * @returns an accessor that indicates whether the nodes are initialized
 */
export function useNodesInitialized() {
  const { store } = useInternalSolidFlow();
  return () => store.nodesInitialized;
}

/**
 * Hook for seeing if the viewport is initialized.
 *
 * Returns `true` once the pan/zoom instance has been created for the flow.
 *
 * @public
 * @returns an accessor that indicates whether the viewport is initialized
 */
export function useViewportInitialized() {
  const { store } = useInternalSolidFlow();
  return () => store.viewportInitialized;
}
