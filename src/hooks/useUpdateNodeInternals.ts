import type { UpdateNodeInternals } from "@xyflow/system";

import { useInternalSolidFlow } from "@/components/contexts";

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
    const updates = new Map();

    updateIds.forEach((updateId) => {
      const nodeElement = store.domNode?.querySelector(
        `.solid-flow__node[data-id="${updateId}"]`,
      ) as HTMLDivElement;

      if (nodeElement) {
        updates.set(updateId, { id: updateId, nodeElement, force: true });
      }
    });

    requestAnimationFrame(() => actions.updateNodeInternals(updates));
  };

  return updateInternals;
}
