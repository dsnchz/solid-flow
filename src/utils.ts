import { isEdgeBase, isNodeBase, type XYPosition } from "@xyflow/system";

import type { Edge, Node } from "@/types";
import { createMemo, createSignal } from "solid-js";

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

export function deepTrack(value: unknown) {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepTrack);
  }
}

export function createWritable<T>(fn: () => T) {
  const signal = createMemo(() => createSignal(fn()));
  const get = () => signal()[0]();
  const set = (v: any) => signal()[1](v);
  return [get, set] as ReturnType<typeof createSignal<T>>;
}
