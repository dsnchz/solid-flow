import { isServer } from "@solidjs/web";
import { type Accessor, createSignal, getObserver, type Signal } from "solid-js";

type Entry = { readonly id: string };

export type ReportedIds = {
  /**
   * The ids, as a read-only record (`id in record`, `record[id]`,
   * `Object.keys(record)`): a tracked `in` / get subscribes to that id
   * alone, a key enumeration to the membership.
   */
  readonly record: Readonly<Record<string, Entry>>;
  /** Reactive: how many ids are present (subscribes to the membership). */
  readonly size: Accessor<number>;
  /** Reactive: the ids, one array per membership change (subscribes to the membership). */
  readonly keys: Accessor<readonly string[]>;
  readonly set: (id: string, present: boolean) => void;
};

/**
 * A keyed id record fed by the row derives and cold memos (#22): the rows
 * already compute what the record holds (a node's selection, whether it is
 * measured), so they report it, where a presence projection per row
 * re-read the same leaves: one projection, its subscriptions and a record
 * slot per row, for every row of the graph.
 *
 * The ids live as own properties of a plain object behind the proxy, so an
 * enumeration is native (no trap per key: a descriptor trap cost ~70 ms per
 * `Object.keys` of 10k ids); `size` and `keys` serve the flow's own readers
 * without enumerating at all. Each `set` that flips an id writes the
 * membership tick and the id's own signal, if anyone holds one (created on
 * a tracked `in` / get, dropped with its last subscriber, as in
 * onScreenIds). Writes come from inside the derives (`ownedWrite`), so
 * readers settle in the same flush. Key order is object key order, as the
 * store record it replaces.
 */
export const createReportedIds = (name: string): ReportedIds => {
  const target: Record<string, Entry> = Object.create(null);
  let count = 0;
  let keys: readonly string[] | undefined;
  const signals = new Map<string, Signal<boolean>>();
  const [version, setVersion] = createSignal(0, { ownedWrite: true, name: `${name}.keys` });

  const present = (id: string) => Object.hasOwn(target, id);
  const has = (id: string): boolean => {
    if (!getObserver()) return present(id);
    let signal = signals.get(id);
    if (signal === undefined) {
      // eslint-disable-next-line solid/reactivity -- the tuple is kept whole: the map stores it and `unobserved` compares its identity
      const created = createSignal(present(id), {
        name: `${name}.id`,
        ownedWrite: true,
        unobserved: () => {
          if (signals.get(id) === created) signals.delete(id);
        },
      });
      signals.set(id, created);
      signal = created;
    }
    return signal[0]();
  };

  const record = new Proxy<Record<string, Entry>>(target, {
    get: (_, key) => (typeof key === "string" && has(key) ? target[key] : undefined),
    has: (_, key) => typeof key === "string" && has(key),
    ownKeys: () => {
      version();
      return Reflect.ownKeys(target);
    },
    set: () => true,
    deleteProperty: () => true,
  });

  return {
    record,
    size: () => {
      version();
      return count;
    },
    keys: () => {
      version();
      return (keys ??= Object.keys(target));
    },
    set: (id, on) => {
      if (on === present(id)) return;
      keys = undefined;
      if (on) {
        target[id] = Object.freeze({ id });
        count++;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- the record's own key set IS the membership
        delete target[id];
        count--;
      }
      // A server render is pure (see createGeometryFeed): nothing to wake.
      if (isServer) return;
      setVersion((n) => n + 1);
      signals.get(id)?.[1](on);
    },
  };
};
