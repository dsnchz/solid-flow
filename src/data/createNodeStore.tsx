import { createStore, type SetStoreFunction, type Store } from "solid-js/store";

import type { BuiltInNodeTypes, Node, NodeProps, NodeTypes } from "../types";

// Extract the data and type from a node component's props
type ExtractNodeInfo<T> = T extends (props: NodeProps<infer TData, infer TType>) => unknown
  ? { data: TData; type: TType }
  : never;

// Create a discriminated union of all possible node configurations
type AllNodeTypes<TUserNodeTypes extends NodeTypes> =
  TUserNodeTypes extends Record<string, never>
    ? BuiltInNodeTypes
    : BuiltInNodeTypes & TUserNodeTypes;

type NodesInput<TUserNodeTypes extends NodeTypes> = {
  [K in keyof AllNodeTypes<TUserNodeTypes>]: Node<
    ExtractNodeInfo<AllNodeTypes<TUserNodeTypes>[K]>["data"],
    ExtractNodeInfo<AllNodeTypes<TUserNodeTypes>[K]>["type"]
  >;
}[keyof AllNodeTypes<TUserNodeTypes>];

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
  nodes: NodesInput<TUserNodeTypes>[],
): readonly [
  Store<NodesInput<TUserNodeTypes>[]>,
  SetStoreFunction<NodesInput<TUserNodeTypes>[]>,
] => {
  const [store, setStore] = createStore(nodes);

  return [store, setStore] as const;
};
