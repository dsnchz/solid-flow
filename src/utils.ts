import { isEdgeBase, isNodeBase, type XYPosition } from "@xyflow/system";

import type { Edge, Node } from "./types";

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
 * Schedules a callback during idle time, falling back to a macrotask where
 * `requestIdleCallback` is unavailable (Safari, jsdom).
 */
export const scheduleIdleCallback: (callback: () => void) => void =
  typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (callback) => setTimeout(callback, 0);

/**
 * Reactive prop defaulting with skip-undefined semantics: a prop counts as
 * "absent" when it reads `undefined`, so parents forwarding optional props
 * (e.g. `<Handle position={props.targetPosition} />`) do not clobber defaults.
 * This is deliberate policy on top of Solid 2.0's `merge`, where `undefined`
 * is a real value that overrides.
 */
export function propDefaults<T extends object, D extends Partial<T>>(
  props: T,
  defaults: D,
): T & Required<Pick<T, keyof D & keyof T>> {
  const out = {} as T & Required<Pick<T, keyof D & keyof T>>;
  const keys = new Set([...Object.keys(defaults), ...Object.keys(props)]);
  for (const key of keys) {
    Object.defineProperty(out, key, {
      get: () =>
        (props as Record<string, unknown>)[key] !== undefined
          ? (props as Record<string, unknown>)[key]
          : (defaults as Record<string, unknown>)[key],
      enumerable: true,
      configurable: true,
    });
  }
  return out;
}

import {
  type Connection,
  type EdgeBase,
  getNodesInside,
  type NodeLookup,
  type Transform,
} from "@xyflow/system";

import type { InternalNode } from "./types";

export const getEdgeId = (connection: Connection | EdgeBase): string => {
  const { source, sourceHandle, target, targetHandle } = connection;
  return `xy-edge__${source}${sourceHandle || ""}-${target}${targetHandle || ""}`;
};

/** Viewport-culled node set (the #15 onlyRenderVisibleElements primitive). */
export function getVisibleNodes<NodeType extends Node = Node>(
  nodeLookup: NodeLookup<InternalNode<NodeType>>,
  transform: Transform,
  width: number,
  height: number,
): Map<string, InternalNode<NodeType>> {
  const visibleNodes = new Map<string, InternalNode<NodeType>>();
  getNodesInside(nodeLookup, { x: 0, y: 0, width: width, height: height }, transform, true).forEach(
    (node) => {
      visibleNodes.set(node.id, node);
    },
  );
  return visibleNodes;
}
