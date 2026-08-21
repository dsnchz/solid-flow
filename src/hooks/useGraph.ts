import type { Viewport } from "@xyflow/system";
import type { Accessor } from "solid-js";

import { useInternalSolidFlow } from "~/components/contexts";
import type { Edge, Node } from "~/types";

/**
 * Hook for getting the current nodes from the store.
 *
 * @public
 * @returns store with an array of nodes
 */
export function useNodes<NodeType extends Node = Node>(): Accessor<NodeType[]> {
  const { store } = useInternalSolidFlow<NodeType>();
  return () => store.nodes as unknown as NodeType[];
}

/**
 * Hook for getting the current edges from the store.
 *
 * @public
 * @returns store with an array of edges
 */
export function useEdges<EdgeType extends Edge = Edge>(): Accessor<EdgeType[]> {
  const { store } = useInternalSolidFlow<Node, EdgeType>();
  return () => store.edges as unknown as EdgeType[];
}

/**
 * Hook for getting the current viewport from the store.
 *
 * @public
 * @returns store with the viewport object
 */
export function useViewport(): Accessor<Viewport> {
  const { store } = useInternalSolidFlow();
  return () => store.viewport;
}
