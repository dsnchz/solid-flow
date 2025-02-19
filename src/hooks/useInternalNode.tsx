import type { Accessor } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import type { InternalNode } from "@/shared/types";

/**
 * Hook to get an internal node by id.
 *
 * @public
 * @param id - the node id
 * @returns an accessor with an internal node or undefined
 */
export function useInternalNode(id: string): Accessor<InternalNode | undefined> {
  const { store } = useFlowStore();
  return () => store.nodeLookup.get(id);
}
