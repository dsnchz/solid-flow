import {
  createOptimisticStore,
  createStore,
  type Refreshable,
  type Store,
  type StoreSetter,
} from "solid-js";

/**
 * The ONE runtime implementation behind all four typed store factories
 * (`createNodeStore` / `createEdgeStore` and their optimistic twins). The
 * public factories are guided-union typing shells — their overloads carry the
 * DX and the docs — and delegate here, so store behavior is edited in exactly
 * one place.
 */

/** An async seed: "Fetch High" promise, or a live stream of states. */
export type AsyncSeed<T> = () => Promise<T[]> | AsyncIterable<T[]>;
export type SeedInput<T> = T[] | AsyncSeed<T>;

/** Applies `map` to every row a seed input produces — the array, the promised array, or each streamed array. */
export const mapSeedInput = <T>(input: SeedInput<T>, map: (row: T) => T): SeedInput<T> => {
  if (typeof input !== "function") return input.map(map);
  return () => {
    const result = input();
    if (Symbol.asyncIterator in result) {
      const rows = result;
      return (async function* () {
        for await (const batch of rows) yield batch.map(map);
      })();
    }
    return result.then((batch) => batch.map(map));
  };
};

export const createSeededStore = <T>(
  input: SeedInput<T>,
): readonly [Store<T[]>, StoreSetter<T[]>] => {
  const [store, setStore] =
    typeof input === "function" ? createStore<T[]>(input, []) : createStore(input);
  return [store, setStore] as const;
};

export function createSeededOptimisticStore<T>(
  input: AsyncSeed<T>,
): readonly [Store<T[]> & Refreshable<T[]>, StoreSetter<T[]>];
// Union form for the typed factories' implementation signatures (their own
// public overloads have already narrowed; the Refreshable brand is applied
// by THEIR derived-form overloads).
export function createSeededOptimisticStore<T>(
  input: SeedInput<T>,
): readonly [Store<T[]>, StoreSetter<T[]>];
export function createSeededOptimisticStore<T>(
  input: SeedInput<T>,
): readonly [Store<T[]>, StoreSetter<T[]>] {
  const [store, setStore] =
    typeof input === "function"
      ? createOptimisticStore<T[]>(input, [])
      : createOptimisticStore<T[]>(input);
  return [store, setStore] as const;
}
