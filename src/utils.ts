import { isEdgeBase, isNodeBase, type XYPosition } from "@xyflow/system";

import type { Edge, Node } from "@/types";
import { createMemo, createSignal, type Accessor } from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";

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

export const toPxString = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : `${value}px`;

export const ARROW_KEY_DIFFS: Record<string, XYPosition> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * Recursively tracks all properties of an object for reactivity
 * @param value - The value to deeply track. If it's an object, all its nested properties will be accessed to trigger reactivity
 * @remarks This function is useful when you need to ensure all nested properties of an object are tracked in a reactive context
 * @example
 * ```ts
 * createEffect(() => {
 *   deepTrack(store.nodes); // Tracks all properties of all nodes
 *   console.log('Any property change in nodes will trigger this effect');
 * });
 * ```
 */
export function deepTrack(value: unknown) {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepTrack);
  }
}

/**
 * Creates a signal that can also be updated if the accessor updates.
 * @param accessor - A function that returns the initial value for the signal
 * @returns A tuple of [getter, setter] similar to createSignal, but the signal is recreated when the accessor's value changes
 * @remarks This is useful when you need a signal that can be manually set but also updates when its source value changes
 * @example
 * ```ts
 * const [width, setWidth] = createWritable(() => config().width);
 * // width() will return config().width initially
 * // setWidth(100) will update the signal to 100
 * // If config().width changes, a new signal width() is updated to the new value
 * ```
 */
export function createWritable<T>(accessor: Accessor<T>) {
  const signal = createMemo(() => createSignal(accessor()));
  const get = () => signal()[0]();
  const set = (v: any) => signal()[1](v);
  return [get, set] as ReturnType<typeof createSignal<T>>;
}

/**
 * Creates a store setter function that operates on a reactive store value
 * @param accessor - A function that returns the store object to create a setter for
 * @returns A SetStoreFunction that can be used to update the store
 * @remarks This utility creates a memoized store setter that recreates when the accessor's value changes.
 * @example
 * ```ts
 * const setNodes = createStoreSetter(() => store.nodes);
 * // Can be used with all store setter patterns:
 * setNodes(0, "selected", true); // Update specific property
 * setNodes((node) => node.id === "1", "position", { x: 100, y: 100 }); // Update with filter
 * setNodes(produce((nodes) => { ... })); // Update with produce
 * ```
 */
export function createStoreSetter<T extends object>(accessor: Accessor<T>): SetStoreFunction<T> {
  const setStoreMemo = createMemo(() => {
    const [_, set] = createStore(accessor());
    return set;
  });
  // @ts-expect-error - SetStoreFunction's parameters are too painful to type
  return (...args) => setStoreMemo()(...args);
}
