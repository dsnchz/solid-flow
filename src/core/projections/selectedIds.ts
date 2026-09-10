import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import { createPresenceIds } from "./presenceIds";

type SelectableRow = { readonly id: string; readonly selected?: boolean };

/**
 * Keyed selected-presence projection (drag-start profile, bench round 12
 * follow-up): the previous selection views were monolithic memos filtering
 * the whole graph — every recompute tore down and rebuilt ~2 subscriptions
 * PER ELEMENT (~137ms of pure graph marking per selection change @10k, the
 * same pathology round 10 cured in the minimap). Each row decides only its
 * own presence (deps: its `selected` leaf and its overlay key) — see
 * createPresenceIds.
 */
export const createSelectedIds = (
  rows: () => readonly SelectableRow[],
  overlay: () => SelectionOverlay,
): Record<string, { id: string }> =>
  createPresenceIds(
    rows,
    (row) => joinSelected(row.selected, overlayEntry(overlay(), row.id)),
    "selectedIds",
  );
