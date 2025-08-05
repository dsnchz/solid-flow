import { type Accessor, createSignal, type Setter } from "solid-js";

import type { BuiltInEdgeTypes, Edge, EdgeProps, EdgeTypes } from "../types";

// Extract the data and type from a node component's props
type ExtractEdgeInfo<T> = T extends (props: EdgeProps<infer TData, infer TType>) => unknown
  ? { data: TData; type: TType }
  : never;

// Create a discriminated union of all possible node configurations
type AllEdgeTypes<TUserEdgeTypes extends EdgeTypes> =
  TUserEdgeTypes extends Record<string, never>
    ? BuiltInEdgeTypes
    : BuiltInEdgeTypes & TUserEdgeTypes;

type EdgesInput<TUserEdgeTypes extends EdgeTypes> = {
  [K in keyof AllEdgeTypes<TUserEdgeTypes>]: Edge<
    ExtractEdgeInfo<AllEdgeTypes<TUserEdgeTypes>[K]>["data"],
    ExtractEdgeInfo<AllEdgeTypes<TUserEdgeTypes>[K]>["type"]
  >;
}[keyof AllEdgeTypes<TUserEdgeTypes>];

/**
 * Creates a type-safe reactive store of edges for use in Solid Flow.
 *
 * This utility function provides full type safety and autocomplete for creating edges,
 * combining both built-in edge types (default, straight, step, smoothstep) and custom user-defined
 * edge types. When a specific edge type is selected, TypeScript automatically infers the
 * required data structure and validates the edge configuration.
 *
 * @template TUserEdgeTypes - The user's custom edge types map (optional)
 * @param edges - Array of edge configurations to create
 * @returns A SolidJS store tuple [store, setStore] with properly typed Edge objects
 *
 * @example
 * ```typescript
 * // Using only built-in edge types (no generic parameter needed)
 * const [builtInEdges, setBuiltInEdges] = createEdgeStore([
 *   {
 *     id: "1",
 *     source: "1",
 *     target: "2",
 *     type: "default",
 *     data: { label: "Start" }
 *   },
 *   {
 *     id: "2",
 *     source: "2",
 *     target: "3",
 *     type: "default",
 *     data: { label: "Process" }
 *   }
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Using custom edge types (requires generic parameter)
 * const customEdgeTypes = {
 *   textEdge: (props: EdgeProps<{ content: string }, "textEdge">) =>
 *     <div>{props.data.content}</div>,
 *   numberEdge: (props: EdgeProps<{ value: number }, "numberEdge">) =>
 *     <div>{props.data.value}</div>
 * } satisfies EdgeTypes;
 *
 * const [mixedEdges, setMixedEdges] = createEdgeStore<typeof customEdgeTypes>([
 *   {
 *     id: "1",
 *     source: "1",
 *     target: "2",
 *     type: "default",        // Built-in type
 *     data: { label: "Input" }
 *   },
 *   {
 *     id: "2",
 *     source: "2",
 *     target: "3",
 *     type: "textEdge",     // Custom type - gets autocomplete
 *     data: { content: "Custom text edge" }  // Type-safe data
 *   },
 *   {
 *     id: "3",
 *     source: "3",
 *     target: "4",
 *     type: "numberEdge",   // Another custom type
 *     data: { value: 42 },  // Type-safe data
 *     style: { "background-color": "lightblue" }  // All Edge properties available
 *   }
 * ]);
 * ```
 *
 * @remarks
 * - Provides autocomplete for the `type` field with all available node types
 * - Validates `data` structure based on the selected node type
 * - Supports all Node properties (style, draggable, hidden, etc.)
 * - Works seamlessly with both built-in and custom node types
 * - Type errors prevent invalid type names or incorrect data structures
 */
export const createEdges = <TUserEdgeTypes extends EdgeTypes = Record<string, never>>(
  edges: EdgesInput<TUserEdgeTypes>[],
): readonly [Accessor<EdgesInput<TUserEdgeTypes>[]>, Setter<EdgesInput<TUserEdgeTypes>[]>] => {
  const [_edges, _setEdges] = createSignal(edges);
  return [_edges, _setEdges] as const;
};
