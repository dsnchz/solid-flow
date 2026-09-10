import { type Accessor, createSignal } from "solid-js";

/**
 * A plain geometry map fed by a row derive, plus the two things a derived
 * record needs to follow it reactively without subscribing to every row:
 * `changes` (a tick bumped once per batch of reports; `ownedWrite` because reports
 * come from inside the row derives, and the write must land in the SAME
 * flush so dependents settle before anything paints or unmounts) and
 * `takeChanged` (the ids reported since the last drain). Readers that want
 * the whole map just read it — it is not reactive.
 */
export type GeometryFeed<R> = {
  readonly map: ReadonlyMap<string, R>;
  readonly report: (id: string, rect: R | null) => void;
  readonly changes: Accessor<number>;
  readonly takeChanged: () => Set<string>;
};

export const createGeometryFeed = <R>(name = "geometry"): GeometryFeed<R> => {
  const map = new Map<string, R>();
  let pending = new Set<string>();
  const [changes, setChanges] = createSignal(0, { ownedWrite: true, name: `${name}.changes` });
  return {
    map,
    report: (id, rect) => {
      if (rect) map.set(id, rect);
      else map.delete(id);
      pending.add(id);
      // one tick per batch: the consumer drains `pending`, so only the first
      // report since the last drain needs to wake it (20k reports at a 10k
      // mount would otherwise be 20k signal writes)
      if (pending.size === 1) setChanges((n) => n + 1);
    },
    changes,
    takeChanged: () => {
      const out = pending;
      pending = new Set();
      return out;
    },
  };
};
