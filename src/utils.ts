import { spread } from "@solidjs/web";
import {
  type Connection,
  type EdgeBase,
  isEdgeBase,
  isNodeBase,
  type XYPosition,
} from "@xyflow/system";
import { createEffect, getOwner, type Owner, runWithOwner } from "solid-js";

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
/**
 * Upper bound on how long the measurement ingest may wait for idle time.
 * Under continuous input (a NodeResizer drag, live-data resizes) idle time
 * can be starved, and without a timeout edges lag the resizing node for as
 * long as the input keeps coming. Two frames keeps the lag invisible.
 */
const IDLE_TIMEOUT_MS = 32;
export const scheduleIdleCallback: (callback: () => void) => void =
  typeof requestIdleCallback === "function"
    ? (callback) => requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS })
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

/**
 * Class string from string/object parts (falsy parts and false keys dropped).
 * Per-row elements assign their class as ONE string: @solidjs/web's
 * array/object class form flattens and diffs a key map on every assignment
 * (~200ms of a 10k mount, bench round 21); a string is one attribute write.
 */
export const cx = (
  ...parts: (string | number | false | null | undefined | Record<string, unknown>)[]
): string => {
  let out = "";
  for (const part of parts) {
    if (!part && part !== 0) continue;
    if (typeof part === "object") {
      for (const key in part) if (part[key]) out += (out ? " " : "") + key;
    } else out += (out ? " " : "") + part;
  }
  return out;
};

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

/**
 * Extra props as element attributes, decided ONCE from the keys present when
 * the component mounts: a JSX props object has a fixed key set, so this is
 * exact for JSX usage, and a component given no extra prop installs no
 * spread at all. A spread is a render effect that re-collects every key of
 * its source on every run, and with a spread on the element the compiler
 * routes ALL of the element's attributes through it (bench rounds 35/36:
 * BaseEdge 169 -> 48 ms, Handle 296 -> 115 ms inclusive at 10k).
 */
export const extraKeysOf = (props: object, own: ReadonlySet<string>): readonly string[] =>
  Object.keys(props).filter((key) => !own.has(key));

/**
 * Installs the spread of `keys` from `props` onto `el` (nothing when there
 * are none). Call from the element's ref with the component's owner: ref
 * callbacks run outside it.
 */
export const spreadExtras = (
  el: Element,
  props: object,
  keys: readonly string[],
  owner: Owner | null,
): void => {
  if (keys.length === 0) return;
  const extras: Record<string, unknown> = {};
  for (const key of keys) {
    Object.defineProperty(extras, key, {
      get: () => Reflect.get(props, key),
      enumerable: true,
    });
  }
  runWithOwner(owner, () => spread(el, extras, true));
};

/**
 * Installs a `spread` of `attrs()` on `el` the first time it is defined
 * (user `domAttributes` on a node/edge wrapper). Rows without domAttributes —
 * the common case — pay one boolean effect instead of the spread machinery
 * (collectProps/assign, ~22 µs per row at 10k: mount profile round 30). Once
 * installed the spread stays reactive (clearing removes the attributes), and
 * its effects are owned by the calling component (disposed with it).
 */
export const spreadOnDemand = (
  el: Element,
  attrs: () => Record<string, unknown> | undefined,
): void => {
  const owner = getOwner();
  let installed = false;
  createEffect(
    () => attrs() !== undefined,
    (present) => {
      if (!present || installed) return;
      installed = true;
      runWithOwner(owner, () => spread(el, () => attrs() ?? {}, true));
    },
    { name: "domAttributes" },
  );
};
