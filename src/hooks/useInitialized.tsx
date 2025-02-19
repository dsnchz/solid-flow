import { useFlowStore } from "@/components/contexts";

/**
 * Hook for seeing if nodes are initialized
 * @returns - nodesInitialized Writable
 */
export function useNodesInitialized() {
  const { store } = useFlowStore();
  return store.nodesInitialized;
}

/**
 * Hook for seeing if the flow is initialized
 * @returns - initialized Writable
 */
export function useInitialized() {
  const { store } = useFlowStore();
  return store.initialized;
}
