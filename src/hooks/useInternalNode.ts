import type { Accessor } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import type { InternalNode } from "@/types";

/**
 * Hook to get an internal node (the node enriched with measured dimensions,
 * absolute position, and z-order) by id.
 *
 * The id is an accessor (not a plain string) on purpose: passing a raw
 * reactive read like `props.nodeId` would capture the value once and silently
 * lose reactivity — `useInternalNode(() => props.nodeId)` keeps it live.
 *
 * @public
 * @param id - a reactive accessor for the node id
 * @returns an accessor with the internal node, or undefined while absent
 */
export function useInternalNode(id: Accessor<string>): Accessor<InternalNode | undefined> {
  const { flow } = useInternalSolidFlow();
  return () => flow.internalNodes[id()];
}
