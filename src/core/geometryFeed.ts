import { isServer } from "@solidjs/web";
import { type Accessor, createSignal } from "solid-js";

/**
 * A plain geometry map fed by a row derive, plus the two things a derived
 * record needs to follow it reactively without subscribing to every row:
 * `changes` (a tick bumped on every report; `ownedWrite` because reports
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
  /** A drain of its own for a second draining reader (the edge boxes). */
  readonly createDrain: () => () => Set<string>;
};

export const createGeometryFeed = <R>(name = "geometry"): GeometryFeed<R> => {
  const map = new Map<string, R>();
  const drains: { pending: Set<string> }[] = [];
  const createDrain = () => {
    const drain = { pending: new Set<string>() };
    drains.push(drain);
    return () => {
      const out = drain.pending;
      drain.pending = new Set();
      return out;
    };
  };
  const takeChanged = createDrain();
  const [changes, setChanges] = createSignal(0, { ownedWrite: true, name: `${name}.changes` });
  return {
    map,
    report: (id, rect) => {
      if (rect) map.set(id, rect);
      else map.delete(id);
      for (const drain of drains) drain.pending.add(id);
      // A server render is pure: nothing re-runs, so there is no reader to
      // wake, and the runtime deprecates a signal write there (SERVER_WRITE,
      // slated to become an error). The map above still fills: the server's
      // layout (the minimap's bounds) reads it.
      if (isServer) return;
      // Every report bumps the tick: besides the draining consumers (the
      // on-screen records, the edge boxes), readers that only SAMPLE the map
      // on the tick (the selected-nodes bounds, bench round 41) must wake on
      // every change, and those never drain. A signal write per report is
      // cheap — the observers are already dirty after the first one in a flush.
      setChanges((n) => n + 1);
    },
    changes,
    takeChanged,
    createDrain,
  };
};
