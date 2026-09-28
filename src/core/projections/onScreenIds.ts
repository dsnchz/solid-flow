import type { Rect } from "@xyflow/system";
import { type Accessor, createMemo, createSignal, getObserver, type Signal } from "solid-js";

import { rectsOverlap } from "../culling";

export type OnScreenSource = {
  /** The row derive's plain geometry map (see createGeometryFeed). */
  readonly geometry: ReadonlyMap<string, Rect>;
  /** Reactive: the quantized culling viewport (null while unmeasured). */
  readonly cullingViewport: Rect | null;
  /** Reactive tick + drain of the ids whose geometry changed since. */
  readonly changes: Accessor<number>;
  readonly takeChanged: () => Set<string>;
};

/** Per-id on-screen membership: a tracked `has` subscribes to that id alone. */
export type OnScreenIds = { readonly has: (id: string) => boolean };

/**
 * The rows whose rect overlaps the culling viewport (bench rounds 26 and 52).
 * The overlap test runs here, ONCE per change, over the plain geometry map —
 * a full pass when the viewport steps (10k rect tests, ~1 ms), only the
 * reported ids when geometry changes — into a plain set, and only the ids
 * that flip notify. The old shape (one memo per row over the shared
 * viewport) re-ran 20k memos through the store proxies on every step: 50-66
 * ms frames on a 10k pane drag.
 *
 * Each row asks `has(id)` and subscribes to its own boolean signal, created
 * on the first tracked read and dropped when its last subscriber goes. A
 * keyed store record did the same per-key job until round 52, but the
 * engine folds a projection's whole record on every commit that writes it,
 * ~4 us per present key: ~1.5-2 ms per record at every quantization step of
 * a 10k pan, and again on every frame of a drag at the pane edge, where the
 * auto-pan moves both the node and the viewport. Signals have nothing to
 * fold: a step costs the flips.
 *
 * The sweep is an eager memo nobody reads; it writes the flipped rows'
 * signals from inside the flush (`ownedWrite`), so a row settles in the same
 * flush as the step. Nothing is on screen while the viewport is null; the
 * row rules treat "culling inactive" separately (`nodeCulled` /
 * `edgeCulled`), so an empty membership never hides anything on its own.
 */
export const createOnScreenIds = (source: OnScreenSource, name: string): OnScreenIds => {
  let lastViewport: Rect | null = null;
  const present = new Set<string>();
  const signals = new Map<string, Signal<boolean>>();

  const apply = (id: string, rect: Rect | undefined, viewport: Rect | null) => {
    const on = !!rect && !!viewport && rectsOverlap(rect, viewport);
    if (on === present.has(id)) return;
    if (on) present.add(id);
    else present.delete(id);
    signals.get(id)?.[1](on);
  };

  createMemo(
    () => {
      const viewport = source.cullingViewport;
      source.changes();
      const changed = source.takeChanged();
      if (viewport !== lastViewport) {
        lastViewport = viewport;
        if (!viewport) {
          for (const id of [...present]) apply(id, undefined, null);
          return;
        }
        source.geometry.forEach((rect, id) => apply(id, rect, viewport));
        // ids reported and then removed before this pass: drop them
        for (const id of changed) if (!source.geometry.has(id)) apply(id, undefined, viewport);
        return;
      }
      for (const id of changed) apply(id, source.geometry.get(id), viewport);
    },
    { name },
  );

  return {
    has: (id) => {
      // An untracked read has nothing to subscribe: answer from the set.
      if (!getObserver()) return present.has(id);
      let signal = signals.get(id);
      if (signal === undefined) {
        const created = createSignal(present.has(id), {
          name: `${name}.row`,
          ownedWrite: true,
          unobserved: () => {
            if (signals.get(id) === created) signals.delete(id);
          },
        });
        signals.set(id, created);
        signal = created;
      }
      return signal[0]();
    },
  };
};
