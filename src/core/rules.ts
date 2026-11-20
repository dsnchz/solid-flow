import {
  type Connection,
  type EdgeBase,
  isEdgeBase,
  isNodeBase,
  type OnError,
} from "@xyflow/system";
import { DEV } from "solid-js";

import type { Edge, Node } from "@/types";

// The flow's small shared rules: element guards, edge ids, selectability,
// and the default flow-error warning. Headless: used by core and by the
// render layer.

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
 * The default `onFlowError`: a console warning, in development builds of
 * solid-js only (React Flow / Svelte Flow warn in development only too).
 * The help link is the README's table of the codes the flow reports.
 */
export const warnFlowError: OnError = (id, message) => {
  if (DEV) {
    console.warn(
      `[solid-flow] ${id}: ${message} Help: https://github.com/dsnchz/solid-flow#flow-errors`,
    );
  }
};
