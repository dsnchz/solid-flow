import { isServer } from "@solidjs/web";
import { type Accessor, createSignal } from "solid-js";

/**
 * The ids a culling rule must never cull for a reason of their own row
 * (nodePinned / edgePinned: selected, `cullable: false`, unmeasured, handles
 * unknown), as a plain set the row derives keep, plus a tick bumped on every
 * flip and the ids flipped since the last drain. The unmount tier's mounted
 * list reads the set on the tick instead of reading every row through the
 * store proxies (#22). `set` from a derive is the geometry feed's pattern:
 * an `ownedWrite` tick, so the list settles in the same flush as the row.
 */
export type CullPins = {
  /** Plain membership: never subscribes. */
  readonly has: (id: string) => boolean;
  readonly set: (id: string, pinned: boolean) => void;
  readonly changes: Accessor<number>;
  /** The ids flipped since the last call (one draining reader: the mounted list). */
  readonly takeChanged: () => Set<string>;
};

export const createCullPins = (name: string): CullPins => {
  const pinned = new Set<string>();
  let pending = new Set<string>();
  const [changes, setChanges] = createSignal(0, { ownedWrite: true, name: `${name}.changes` });
  return {
    has: (id) => pinned.has(id),
    set: (id, on) => {
      if (on === pinned.has(id)) return;
      if (on) pinned.add(id);
      else pinned.delete(id);
      // A server render is pure (see createGeometryFeed): nothing to wake.
      if (isServer) return;
      pending.add(id);
      setChanges((n) => n + 1);
    },
    changes,
    takeChanged: () => {
      const out = pending;
      pending = new Set();
      return out;
    },
  };
};
