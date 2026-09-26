import { createMemo, createProjection, mapArray } from "solid-js";

import { createRowRecordProjection } from "./rowRecord";

/**
 * Keyed presence record over a per-row predicate: `record[id]` exists iff
 * `present(row)` — the fan-in repair the engine's WIDE_WRITE/HUGE_FAN_IN
 * diagnostics prescribe. Each row owns a tiny projection deciding only its
 * own presence (its deps are exactly the leaves the predicate reads), and the
 * record diff is O(changed rows). Consumers read membership
 * (`Object.keys(record).length`, `id in record`) instead of subscribing to a
 * leaf of every row; a monolithic memo over the same predicate re-ran, tore
 * down and rebuilt ~n×k subscriptions on any single row change.
 *
 * Template for selectedIds (bench round 12) and the unmeasured set behind
 * `nodesInitialized` (round 16).
 */
export const createPresenceIds = <Row extends { readonly id: string }>(
  rows: () => readonly Row[],
  present: (row: Row) => boolean,
  name: string,
): Record<string, { id: string }> => {
  const rowStores = createMemo(
    mapArray(
      rows,
      (rowAccessor) => {
        const id = rowAccessor().id;
        const store: { row: { id: string } | null } = createProjection<{
          row: { id: string } | null;
        }>(
          (draft) => {
            // The accessor tracks the array slot: a whole-graph replacement
            // with fresh objects of the same ids re-derives THIS row instead
            // of disposing and recreating it (bench round 41).
            // Write only on a FLIP: a re-derive that lands the same presence
            // keeps the `{ id }` object, so the record slot is never repointed
            // and record subscribers stay quiet (O(changed-row) end to end).
            const next = present(rowAccessor());
            if (next !== (draft.row !== null)) draft.row = next ? { id } : null;
          },
          { row: null },
          { key: null, name: `${name}.row` },
        );
        return { id, store };
      },
      { keyed: (row) => row.id },
    ),
    { name: `${name}.rows` },
  );

  return createRowRecordProjection(rowStores, name);
};
