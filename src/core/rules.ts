import { type Connection, type EdgeBase, isEdgeBase, isNodeBase } from "@xyflow/system";

import type { Edge, Node } from "@/types";

// The flow's small shared rules: element guards, edge ids, selectability,
// and the error channel. Headless: used by core and by the render layer.

/**
 * Test whether an object is usable as a Node
 * @public
 * @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true
 * @param element - The element to test
 * @returns A boolean indicating whether the element is an Node
 */
export const isNode = <NodeType extends Node = Node>(element: unknown): element is NodeType =>
  isNodeBase<NodeType>(element);

/**
 * Test whether an object is usable as an Edge
 * @public
 * @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true
 * @param element - The element to test
 * @returns A boolean indicating whether the element is an Edge
 */
export const isEdge = <EdgeType extends Edge = Edge>(element: unknown): element is EdgeType =>
  isEdgeBase<EdgeType>(element);

export const getEdgeId = (connection: Connection | EdgeBase): string => {
  const { source, sourceHandle, target, targetHandle } = connection;
  return `xy-edge__${source}${sourceHandle || ""}-${target}${targetHandle || ""}`;
};

/**
 * The one edge-selectability rule, used by click selection, box selection,
 * and connected-edge selection alike: the edge's own flag wins, then the
 * flow's defaultEdgeOptions, then the global elementsSelectable switch.
 * (These three paths once disagreed — box selection ignored
 * elementsSelectable entirely; audit 2026-08-24 A7.)
 */
export const isEdgeSelectable = (
  edge: Pick<Edge, "selectable">,
  store: {
    readonly elementsSelectable: boolean;
    readonly defaultEdgeOptions: { readonly selectable?: boolean };
  },
): boolean => edge.selectable ?? store.defaultEdgeOptions.selectable ?? store.elementsSelectable;

/**
 * The single runtime error channel: user-supplied `onFlowError` when
 * present, an identifiable console warning otherwise. (Setup-time config
 * warnings in seeding stay on console by design — they fire during
 * construction, before a flow error handler is meaningfully attachable.)
 */
export const emitFlowError = (
  onError: ((id: string, message: string) => void) | undefined,
  id: string,
  message: string,
): void => {
  if (onError) onError(id, message);
  else console.warn(`[solid-flow] ${id}: ${message}`);
};
