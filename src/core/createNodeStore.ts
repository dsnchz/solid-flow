import { type StoreSetter } from "solid-js";
import { createStore, type Store } from "solid-js";

import type { BuiltInNodeTypes, Node, NodeProps, NodeTypes, UnknownStruct } from "@/types";

// Extract the data type from a node component's props; components whose
// signature doesn't match the NodeProps shape (extra props, wrappers, no
// props at all) degrade gracefully to an unconstrained data record instead
// of collapsing their map key to `never`.
type NodeDataOf<T> = T extends (props: NodeProps<infer TData, infer _TType>) => unknown
  ? TData
  : UnknownStruct;

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
 * ] satisfies NodesFor<typeof nodeTypes>[];
 * ```
 */
export type NodesFor<TUserNodeTypes extends NodeTypes = Record<string, never>> = {
  [K in keyof AllNodeTypes<TUserNodeTypes>]: Node<
    NodeDataOf<AllNodeTypes<TUserNodeTypes>[K]>,
    K & string
  >;
}[keyof AllNodeTypes<TUserNodeTypes>];

type NodesInput<TUserNodeTypes extends NodeTypes> = NodesFor<TUserNodeTypes>;

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
export const createNodeStore = <TUserNodeTypes extends NodeTypes = Record<string, never>>(
  nodes: NoInfer<NodesInput<TUserNodeTypes>>[],
): readonly [Store<NodesInput<TUserNodeTypes>[]>, StoreSetter<NodesInput<TUserNodeTypes>[]>] => {
  const [store, setStore] = createStore(nodes);

  return [store, setStore] as const;
};
