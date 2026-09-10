import type { Rect } from "@xyflow/system";
import { type Accessor, createProjection } from "solid-js";

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

/**
 * Keyed presence record of the rows whose rect overlaps the culling viewport
 * (bench round 26). The overlap test runs here, ONCE per change, over the
 * plain geometry map — a full pass when the viewport steps (10k rect tests,
 * ~1 ms), only the reported ids when geometry changes — and writes only the
 * keys that flip. Rows read `id in record`, which subscribes per key, so a
 * viewport step wakes exactly the rows that entered or left. The old shape
 * (one memo per row over the shared viewport) re-ran 20k memos through the
 * store proxies on every step: 50-66 ms frames on a 10k pane drag.
 *
 * Empty while the viewport is null; the row rules treat "culling inactive"
 * separately (`nodeCulled` / `edgeCulled`), so an empty record never hides
 * anything on its own.
 */
export const createOnScreenIds = (source: OnScreenSource, name: string): Record<string, true> => {
  let lastViewport: Rect | null = null;
  return createProjection<Record<string, true>>(
    (draft) => {
      const viewport = source.cullingViewport;
      source.changes();
      const changed = source.takeChanged();
      const apply = (id: string, rect: Rect | undefined) => {
        const on = !!rect && !!viewport && rectsOverlap(rect, viewport);
        if (on) {
          if (!(id in draft)) draft[id] = true;
        } else if (id in draft) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed draft removal
          delete draft[id];
        }
      };
      if (viewport !== lastViewport) {
        lastViewport = viewport;
        if (!viewport) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed draft removal
          for (const id of Object.keys(draft)) delete draft[id];
          return;
        }
        source.geometry.forEach((rect, id) => apply(id, rect));
        // ids reported and then removed before this pass: drop their keys
        for (const id of changed) if (!source.geometry.has(id)) apply(id, undefined);
        return;
      }
      for (const id of changed) apply(id, source.geometry.get(id));
    },
    {},
    { key: null, name },
  );
};
