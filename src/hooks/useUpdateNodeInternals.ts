import type { UpdateNodeInternals } from "@xyflow/system";

import { useInternalSolidFlow } from "@/contexts";

/**
 * Hook for updating node internals. Sugar for `commands.updateNodeInternals`.
 *
 * @public
 * @returns function for updating node internals
 */
export function useUpdateNodeInternals(): UpdateNodeInternals {
  const { commands } = useInternalSolidFlow();
  return commands.updateNodeInternals;
}
