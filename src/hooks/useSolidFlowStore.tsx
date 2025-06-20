import { useInternalSolidFlow } from "@/components/contexts";

/**
 * Hook for receiving the current solid flow store.
 *
 * @public
 * @returns current solid flow store as a readable store
 */
export function useSolidFlowStore() {
  const { store } = useInternalSolidFlow();
  return store;
}
