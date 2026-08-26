import { type StoreSetter } from "solid-js";
import { createStore, type Store } from "solid-js";

import type { BuiltInEdgeTypes, Edge, EdgeProps, EdgeTypes, UnknownStruct } from "@/types";

// Extract the data type from an edge component's props; components whose
// signature doesn't match the EdgeProps shape degrade gracefully to an
// unconstrained data record instead of collapsing their map key to `never`.
type EdgeDataOf<T> = T extends (props: EdgeProps<infer TData, infer _TType>) => unknown
  ? TData
  : UnknownStruct;

// Create a discriminated union of all possible edge configurations
type AllEdgeTypes<TUserEdgeTypes extends EdgeTypes> =
  TUserEdgeTypes extends Record<string, never>
    ? BuiltInEdgeTypes
    : BuiltInEdgeTypes & TUserEdgeTypes;

/**
 * The discriminated union of edge configurations for a renderer map: one
 * member per built-in and custom edge type, with `data` narrowed by the
 * `type` discriminant (the MAP KEY — what the renderer actually matches).
 * Use it to carry `createEdgeStore`'s guided typing anywhere a plain array
 * or vanilla store is typed:
 *
 * ```typescript
 * const initialEdges = [
 *   { id: "e1", source: "1", target: "2", type: "labeled", data: { label: "hi" } },
 * ] satisfies SolidFlowEdge<typeof edgeTypes>[];
 * ```
 */
export type SolidFlowEdge<TUserEdgeTypes extends EdgeTypes = Record<string, never>> = {
  [K in keyof AllEdgeTypes<TUserEdgeTypes>]: Edge<
    EdgeDataOf<AllEdgeTypes<TUserEdgeTypes>[K]>,
    K & string
  >;
}[keyof AllEdgeTypes<TUserEdgeTypes>];

type EdgesInput<TUserEdgeTypes extends EdgeTypes> = SolidFlowEdge<TUserEdgeTypes>;

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
 * - Provides autocomplete for the `type` field with all available edge types
 * - Validates `data` structure based on the selected edge type
 * - Supports all Edge properties (style, animated, selectable, etc.)
 * - Works seamlessly with both built-in and custom edge types
 * - Type errors prevent invalid type names or incorrect data structures
 */
/**
 * Also accepts an async seed ("Fetch High"): pass `async () => edges`
 * instead of an array. Reads throw `NotReadyError` until the first value
 * (cover the flow with `<Loading fallback>`); afterwards the store is an
 * ordinary writable store. See {@link createNodeStore} for details.
 */
export const createEdgeStore = <TUserEdgeTypes extends EdgeTypes = Record<string, never>>(
  edges:
    | NoInfer<EdgesInput<TUserEdgeTypes>>[]
    | (() => Promise<NoInfer<EdgesInput<TUserEdgeTypes>>[]>),
): readonly [Store<EdgesInput<TUserEdgeTypes>[]>, StoreSetter<EdgesInput<TUserEdgeTypes>[]>] => {
  const [store, setStore] =
    typeof edges === "function"
      ? createStore<EdgesInput<TUserEdgeTypes>[]>(edges, [])
      : createStore(edges);

  return [store, setStore] as const;
};
