import type { Refreshable, Store, StoreSetter } from "solid-js";

import type { BuiltInNodeTypes, Node, NodeProps, NodeTypes, UnknownStruct } from "@/types";

import { createSeededOptimisticStore, createSeededStore } from "./factory";

// Extract the data type from a node component's props; components whose
// signature doesn't match the NodeProps shape (extra props, wrappers, no
// props at all) degrade gracefully to an unconstrained data record instead
// of collapsing their map key to `never`.
type NodeDataOf<T> = T extends (props: NodeProps<infer TData, infer _TType>) => unknown
  ? TData
  : UnknownStruct;

// NOTE: the type machinery below is intentionally PARALLEL with createEdgeStore.ts
// (TS has no higher-kinded types to abstract the Node/Edge constructors);
// keep the two in sync. Runtime behavior lives once, in ./factory.ts.
// Create a discriminated union of all possible node configurations
type AllNodeTypes<TUserNodeTypes extends NodeTypes> =
  TUserNodeTypes extends Record<string, never>
    ? BuiltInNodeTypes
    : BuiltInNodeTypes & TUserNodeTypes;

/**
 * The discriminated union of node configurations for a renderer map: one
 * member per built-in and custom node type, with `data` narrowed by the
 * `type` discriminant (the MAP KEY — what the renderer actually matches).
 * Use it to carry `createNodeStore`'s guided typing anywhere a plain array
 * or vanilla store is typed:
 *
 * ```typescript
 * const initialNodes = [
 *   { id: "1", type: "custom", position: { x: 0, y: 0 }, data: { value: 1 } },
 * ] satisfies SolidFlowNode<typeof nodeTypes>[];
 * ```
 */
export type SolidFlowNode<TUserNodeTypes extends NodeTypes = Record<string, never>> = {
  [K in keyof AllNodeTypes<TUserNodeTypes>]: Node<
    NodeDataOf<AllNodeTypes<TUserNodeTypes>[K]>,
    K & string
  >;
}[keyof AllNodeTypes<TUserNodeTypes>];

type NodesInput<TUserNodeTypes extends NodeTypes> = SolidFlowNode<TUserNodeTypes>;

/**
 * Creates a type-safe reactive store of nodes for use in Solid Flow.
 *
 * This utility function provides full type safety and autocomplete for creating nodes,
 * combining both built-in node types (input, output, default, group) and custom user-defined
 * node types. When a specific node type is selected, TypeScript automatically infers the
 * required data structure and validates the node configuration.
 *
 * @template TUserNodeTypes - The user's custom node types map (optional)
 * @param nodes - Array of node configurations to create
 * @returns A SolidJS store tuple [store, setStore] with properly typed Node objects
 *
 * @example
 * ```typescript
 * // Using only built-in node types (no generic parameter needed)
 * const [builtInNodes, setBuiltInNodes] = createNodeStore([
 *   {
 *     id: "1",
 *     position: { x: 0, y: 0 },
 *     type: "input",
 *     data: { label: "Start" }
 *   },
 *   {
 *     id: "2",
 *     position: { x: 200, y: 100 },
 *     type: "default",
 *     data: { label: "Process" }
 *   }
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Using custom node types (requires generic parameter)
 * const customNodeTypes = {
 *   textNode: (props: NodeProps<{ content: string }, "textNode">) =>
 *     <div>{props.data.content}</div>,
 *   numberNode: (props: NodeProps<{ value: number }, "numberNode">) =>
 *     <div>{props.data.value}</div>
 * } satisfies NodeTypes;
 *
 * const [mixedNodes, setMixedNodes] = createNodeStore<typeof customNodeTypes>([
 *   {
 *     id: "1",
 *     position: { x: 0, y: 0 },
 *     type: "input",        // Built-in type
 *     data: { label: "Input" }
 *   },
 *   {
 *     id: "2",
 *     position: { x: 100, y: 100 },
 *     type: "textNode",     // Custom type - gets autocomplete
 *     data: { content: "Custom text node" }  // Type-safe data
 *   },
 *   {
 *     id: "3",
 *     position: { x: 200, y: 200 },
 *     type: "numberNode",   // Another custom type
 *     data: { value: 42 },  // Type-safe data
 *     style: { "background-color": "lightblue" }  // All Node properties available
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
/**
 * Also accepts an async seed ("Fetch High"): pass `async () => nodes` —
 * typically an API call — instead of an array. No memo required: the
 * function goes straight to `createStore`'s projection derive, so reads
 * throw `NotReadyError` until the first value (cover the flow with
 * `<Loading fallback>`), and the graph retries them when the data lands.
 * Afterwards the store is an ordinary writable store — draft writes and
 * wholesale replacement work exactly like the array form.
 *
 * An async GENERATOR works the same way ("a value that keeps arriving"):
 * `createNodeStore(async function* () { for await (const g of stream) yield g.nodes; })`
 * is unsettled until the first yield, then every yield updates the store —
 * the natural source for server-pushed / collaborative graphs (pair with a
 * `live()` server function).
 */
export const createNodeStore = <TUserNodeTypes extends NodeTypes = Record<string, never>>(
  nodes:
    | NoInfer<NodesInput<TUserNodeTypes>>[]
    | (() =>
        | Promise<NoInfer<NodesInput<TUserNodeTypes>>[]>
        | AsyncIterable<NoInfer<NodesInput<TUserNodeTypes>>[]>),
): readonly [Store<NodesInput<TUserNodeTypes>[]>, StoreSetter<NodesInput<TUserNodeTypes>[]>] => {
  return createSeededStore<NodesInput<TUserNodeTypes>>(nodes);
};

/**
 * The optimistic twin of {@link createNodeStore}'s async form: a guided-union
 * wrapper over `createOptimisticStore` for per-mutation server sync (write
 * the prediction in an `action`, `yield` the request, `refresh` to
 * reconcile). Purely a typing convenience — the flow composes with a raw
 * `createOptimisticStore` identically (flow-driven state lives in sidecars
 * and survives overlay reverts); this keeps the same `data`-narrowed-by-
 * `type` guidance as the other factories.
 */
export function createOptimisticNodeStore<TUserNodeTypes extends NodeTypes = Record<string, never>>(
  nodes: NoInfer<NodesInput<TUserNodeTypes>>[],
): readonly [Store<NodesInput<TUserNodeTypes>[]>, StoreSetter<NodesInput<TUserNodeTypes>[]>];
export function createOptimisticNodeStore<TUserNodeTypes extends NodeTypes = Record<string, never>>(
  nodes: () =>
    | Promise<NoInfer<NodesInput<TUserNodeTypes>>[]>
    | AsyncIterable<NoInfer<NodesInput<TUserNodeTypes>>[]>,
): readonly [
  Store<NodesInput<TUserNodeTypes>[]> & Refreshable<NodesInput<TUserNodeTypes>[]>,
  StoreSetter<NodesInput<TUserNodeTypes>[]>,
];
export function createOptimisticNodeStore<TUserNodeTypes extends NodeTypes = Record<string, never>>(
  nodes:
    | NoInfer<NodesInput<TUserNodeTypes>>[]
    | (() =>
        | Promise<NoInfer<NodesInput<TUserNodeTypes>>[]>
        | AsyncIterable<NoInfer<NodesInput<TUserNodeTypes>>[]>),
): readonly [Store<NodesInput<TUserNodeTypes>[]>, StoreSetter<NodesInput<TUserNodeTypes>[]>] {
  // Mirrors the full core surface (value | promise | stream), like the plain
  // factory: the wrapper's only value-add is the guided-union typing.
  return createSeededOptimisticStore<NodesInput<TUserNodeTypes>>(nodes);
}
