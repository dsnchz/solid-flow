import { createMemo, untrack } from "solid-js";

/** O(1) id → row resolution inside store drafts. See {@link createRowIndex}. */
export type RowIndex<T extends { readonly id: string }> = {
  /**
   * Index of `id` in `rows` (a draft or plain array), or -1. O(1) through the
   * membership-cadence index, guarded by a slot identity check; a stale index
   * (a same-batch membership write the memo has not seen) falls back to a scan.
   */
  readonly indexOf: (rows: readonly T[], id: string) => number;
  /** The row for `id` in `rows`, or undefined. */
  readonly get: (rows: readonly T[], id: string) => T | undefined;
};

/**
 * Membership-cadence id → index map for the per-frame writers. The gesture
 * writers (drag positions, selection flips, measurement write-back) used to
 * walk the whole draft to find their k target rows — 10k index-get traps plus
 * 10k `id` traps per drag frame @10k. The index recomputes only when the id
 * list changes (same cadence as `visibleNodeIds`) and resolves each target
 * with two trap reads.
 */
export const createRowIndex = <T extends { readonly id: string }>(
  ids: () => readonly string[],
): RowIndex<T> => {
  const index = createMemo(() => {
    const list = ids();
    const map = new Map<string, number>();
    for (let i = 0; i < list.length; i++) map.set(list[i]!, i);
    return map;
  });

  const indexOf = (rows: readonly T[], id: string): number => {
    const i = untrack(index).get(id);
    if (i !== undefined && rows[i]?.id === id) return i;
    // Miss or slot mismatch: the index lags the draft (writes commit at
    // flush, so a same-batch add is not indexed yet) or the id is unknown.
    // The scan is the correctness floor, never the per-frame path.
    return rows.findIndex((row) => row.id === id);
  };

  return {
    indexOf,
    get: (rows, id) => {
      const i = indexOf(rows, id);
      return i === -1 ? undefined : rows[i];
    },
  };
};
