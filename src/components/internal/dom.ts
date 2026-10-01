import { type JSX, spread } from "@solidjs/web";
import type { XYPosition } from "@xyflow/system";
import {
  createEffect,
  createRoot,
  getOwner,
  isHydrating,
  type Owner,
  runWithOwner,
} from "solid-js";

export const toPxString = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : `${value}px`;

export const ARROW_KEY_DIFFS: Record<string, XYPosition> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** What `cx` takes: any class value a user's `class` prop can hold, plus records with any values. */
type ClassPart = JSX.ClassValue | Record<string, unknown>;

/**
 * Class string from class parts: strings and numbers as is, records by their
 * truthy keys, arrays flattened, booleans and nullish parts dropped (the
 * ClassValue rules, so a user `class` prop of any form can be passed in).
 * Per-row elements assign their class as ONE string: @solidjs/web's
 * array/object class form flattens and diffs a key map on every assignment
 * (~200ms of a 10k mount, bench round 21); a string is one attribute write.
 */
export const cx = (...parts: ClassPart[]): string => {
  let out = "";
  const add = (part: ClassPart): void => {
    if (part === null || part === undefined || typeof part === "boolean" || part === "") return;
    if (Array.isArray(part)) {
      for (const item of part) add(item);
    } else if (typeof part === "object") {
      for (const key in part) if (part[key]) out += (out ? " " : "") + key;
    } else out += (out ? " " : "") + part;
  };
  for (const part of parts) add(part);
  return out;
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

// Hydration ids are built from digits and letters under the render's root
// prefix; "~" never appears in one, so a client-only namespace cannot collide.
let clientOnlyRoots = 0;

/**
 * Runs client-only reactive setup — window listeners, a row's element wiring
 * from its ref — without consuming hydration ids. Owned computations take the
 * next id from their owner's sequence, and hydration matches server markup to
 * the client tree by those ids: a computation the server never creates shifts
 * the id of everything created after it, and the client then looks for keys
 * the server never wrote (every element misses; the hydration lane).
 *
 * While hydrating (`isHydrating()`: the root pass of `hydrate()`, or a
 * streamed boundary while it resumes), `fn` runs in a root seeded with its own id namespace: an
 * explicit id takes no slot from the parent, the root is still owned by the
 * current owner (context and disposal as before), and a computation under it
 * finds no serialized server value for its id, so it just computes. A
 * transparent root would NOT do: its children still draw ids from the
 * parent's sequence. After hydration ids no longer matter and `fn` runs
 * directly, so an ordinary client mount pays no extra owner per row. (Unrelated
 * to @solidjs/web's `clientOnly`, which lazy-loads a component on the client.)
 */
export const clientOnlySetup = <T>(fn: () => T): T =>
  isHydrating() ? createRoot(fn, { id: `~client${clientOnlyRoots++}` }) : fn();

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
  runWithOwner(owner, () => clientOnlySetup(() => spread(el, extras, true)));
};

/**
 * The extra props as one object, for the SERVER's copy of an element that
 * takes them through `spreadExtras` on the client: a ref never runs in a
 * server render, so the server spreads them itself (there is no per-row
 * reactivity cost on the server). The hydration lane checks that both copies
 * end with the same attributes.
 */
export const extrasOf = (props: object, keys: readonly string[]): Record<string, unknown> => {
  const extras: Record<string, unknown> = {};
  for (const key of keys) extras[key] = Reflect.get(props, key);
  return extras;
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
      runWithOwner(owner, () => clientOnlySetup(() => spread(el, () => attrs() ?? {}, true)));
    },
    { name: "domAttributes" },
  );
};
