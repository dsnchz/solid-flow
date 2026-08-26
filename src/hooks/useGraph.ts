import type { Viewport } from "@xyflow/system";
import type { Accessor } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import type { Edge, Node } from "@/types";

/**
 * Hook for getting the current nodes from the store.
 *
 * @public
 * @returns store with an array of nodes
 */
export function useNodes<NodeType extends Node = Node>(): Accessor<readonly NodeType[]> {
  const { flow } = useInternalSolidFlow<NodeType>();
  return () => flow.nodes;
}

/**
 * Hook for getting the current edges from the store.
 *
 * @public
 * @returns store with an array of edges
 */
export function useEdges<EdgeType extends Edge = Edge>(): Accessor<readonly EdgeType[]> {
  const { flow } = useInternalSolidFlow<Node, EdgeType>();
  return () => flow.edges;
}

/**
 * Hook for getting the current viewport from the store.
 *
 * @public
 * @returns store with the viewport object
 */
export function useViewport(): Accessor<Viewport> {
  const { flow } = useInternalSolidFlow();
  return () => flow.viewport;
}
