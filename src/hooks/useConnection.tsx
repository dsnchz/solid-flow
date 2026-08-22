import type { ConnectionState } from "@xyflow/system";
import type { Accessor } from "solid-js";

import { useInternalSolidFlow } from "~/components/contexts";

/**
 * Hook for receiving the current connection.
 *
 * @public
 * @returns current connection as a readable store
 */
export function useConnection(): Accessor<ConnectionState> {
  const { flow } = useInternalSolidFlow();
  return () => flow.connection;
}
