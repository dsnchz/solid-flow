import type { ConnectionState } from "@xyflow/system";

import { useFlowStore } from "@/components/contexts";

/**
 * Hook for receiving the current connection.
 *
 * @public
 * @returns current connection as a readable store
 */
export function useConnection(): ConnectionState {
  const { store } = useFlowStore();

  return store.connection;
}
