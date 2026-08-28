import { createMemo, createProjection, mapArray, onCleanup } from "solid-js";

import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import { createRowRecordProjection } from "./rowRecord";

type SelectableRow = { readonly id: string; readonly selected?: boolean };

/**
 * Keyed selected-presence projection (drag-start profile, bench round 12
 * follow-up): the previous selection views were monolithic memos filtering
 * the whole graph — every recompute tore down and rebuilt ~2 subscriptions
 * PER ELEMENT (~137ms of pure graph marking per selection change @10k, the
 * same pathology round 10 cured in the minimap). Here each row owns a tiny
 * projection deciding only its own presence (deps: its `selected` leaf and
 * its overlay key), and the record diff is O(changed rows). Consumers read
 * the record instead of subscribing to every element.
 */
export const createSelectedIds = (
  rows: () => readonly SelectableRow[],
  overlay: () => SelectionOverlay,
): Record<string, { id: string }> => {
  const rowStores = createMemo(
    mapArray(rows, (row) => {
      const store: { row: { id: string } | null } = createProjection<{
        row: { id: string } | null;
      }>(
        (draft) => {
          draft.row = joinSelected(row.selected, overlayEntry(overlay(), row.id))
            ? { id: row.id }
            : null;
        },
        { row: null },
        { key: null },
      );
      onCleanup(() => void 0);
      return { id: row.id, store };
    }),
  );

  return createRowRecordProjection(rowStores);
};
