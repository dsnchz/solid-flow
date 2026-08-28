/**
 * Selection sidecar (the solid#3085 composition): flow-driven selection lives
 * in a library-owned keyed overlay joined with user rows at read time, plus a
 * best-effort write-through onto the rows for the xyflow parity contract
 * ("reading your store is live"). One unbranched code path over plain and
 * optimistic stores — no store-kind detection, by design.
 *
 * Entry lifecycle is CONFIRM-THEN-RELEASE: a selection command writes the
 * overlay entry and writes through to the row in the same pass; a release
 * effect (createFlowState) deletes the entry once it observes the row
 * carrying the written value. On plain stores that is the next flush — the
 * row governs from then on, so later USER writes through their own store win
 * naturally. On optimistic stores the write-through reverts, the entry never
 * confirms, and the overlay keeps governing — selection survives overlays
 * and refresh reconciles. (Value-based reconciliation can't do this for
 * booleans: a user toggling back is value-identical to an optimistic revert,
 * so lifetime — not value — is what disambiguates.)
 */
export type SelectionOverlay = Record<string, boolean>;

export const joinSelected = (
  rowSelected: boolean | undefined,
  entry: boolean | undefined,
): boolean => entry ?? !!rowSelected;

/** Absent-key-safe overlay read (subscribes even while the key is absent). */
export const overlayEntry = (overlay: SelectionOverlay, id: string): boolean | undefined =>
  id in overlay ? overlay[id] : undefined;
