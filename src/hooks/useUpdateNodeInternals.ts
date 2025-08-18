import type { UpdateNodeInternals } from "@xyflow/system";

import { useInternalSolidFlow } from "@/components/contexts";
import type { InternalUpdateEntry } from "@/data/types";

/**
 * Hook for updating node internals.
 *
 * @public
 * @returns function for updating node internals
 */
export function useUpdateNodeInternals(): UpdateNodeInternals {
  const { store, actions } = useInternalSolidFlow();

  // @todo: do we want to add this to system?
  const updateInternals = (id: string | string[]) => {
    const updateIds = Array.isArray(id) ? id : [id];
    const updates: InternalUpdateEntry[] = [];

    for (const updateId of updateIds) {
      const nodeElement = store.domNode?.querySelector(
        `.solid-flow__node[data-id="${updateId}"]`,
      ) as HTMLDivElement;

      if (!nodeElement) continue;

      updates.push([updateId, { id: updateId, nodeElement, force: true }]);
    }

    actions.requestUpdateNodeInternals(updates);
  };

  return updateInternals;
}
