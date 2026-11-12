import { type Accessor, createMemo } from "solid-js";

import type { CullPins } from "../cullPins";
import type { OnScreenMembership } from "./onScreenIds";

/** Same ids in the same order. */
export const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a === b || (a.length === b.length && a.every((id, i) => id === b[i]));

export type MountedIdsSource = {
  /** Reactive: every row id, in array order. */
  readonly ids: readonly string[];
  /** Reactive: the unmount tier is on and the culling viewport is known. */
  readonly active: boolean;
  readonly onScreen: OnScreenMembership;
  readonly pins: CullPins;
  /** Reactive: the row holding DOM focus (never unmounted mid-interaction). */
  readonly focusedId: string | null;
};

/**
 * The ids a renderer mounts (#22): every id while the unmount tier is off or
 * culling is inactive (the CSS tier, a server render, an unmeasured
 * container); otherwise, in array order, the ids on screen, pinned by their
 * own row (nodePinned / edgePinned) or focused. Off-screen rows get no
 * per-row scope at all: no gate memo, no `Show`.
 *
 * Bench round 6 measured a central filtered list 5x slower than per-row gates
 * because it re-read every row through the store per change. This one reads
 * no row: it filters the id list against two plain sets, and wakes only when
 * the on-screen membership or a pin flips (not on every geometry report).
 * A run woken by pin flips alone keeps the list when every flipped id is on
 * screen or focused anyway: a box selection pins the on-screen nodes it
 * selects on every frame, and a refilter per frame cost ~30 ms per gesture
 * at 10k. The `For` it feeds then mounts and disposes exactly the flipped
 * rows.
 */
export const createMountedIds = (
  source: MountedIdsSource,
  name: string,
): Accessor<readonly string[]> => {
  let lastIds: readonly string[] | undefined;
  let lastVersion = -1;
  let lastFocused: string | null = null;
  let last: readonly string[] = [];
  return createMemo(
    () => {
      const { onScreen, pins } = source;
      // Drained on every run, active or not: the flips pile up otherwise.
      pins.changes();
      const flipped = pins.takeChanged();
      const ids = source.ids;
      if (!source.active) {
        lastIds = undefined;
        return (last = ids);
      }
      const version = onScreen.version();
      const focused = source.focusedId;
      const { present } = onScreen;
      if (ids === lastIds && version === lastVersion && focused === lastFocused) {
        let changes = false;
        for (const id of flipped) {
          if (!present.has(id) && id !== focused) {
            changes = true;
            break;
          }
        }
        if (!changes) return last;
      }
      lastIds = ids;
      lastVersion = version;
      lastFocused = focused;
      return (last = ids.filter((id) => present.has(id) || pins.has(id) || id === focused));
    },
    { equals: sameIds, name },
  );
};
