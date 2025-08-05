import type { Accessor } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";
import type { InternalNode } from "@/types";

/**
 * Hook to get an internal node by id.
 *
 * @public
 * @param id - the node id
 * @returns an accessor with an internal node or undefined
 */
export function useInternalNode(id: string): Accessor<InternalNode | undefined> {
  const { store } = useInternalSolidFlow();
  return () => store.nodeLookup.get(id);
}
