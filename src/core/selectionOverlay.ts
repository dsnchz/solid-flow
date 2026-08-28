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
export type SelectionOverlayEntry = {
  readonly value: boolean;
  /**
   * The ROW PROXY captured at write time (Ryan's #3085 guidance: hold row
   * proxies by reference — reads pierce). The release effect confirms
   * against THIS reference instead of resolving rows through the keyed
   * lookup records: pulling a derived record inside the write flush
   * triggered an O(sources) marking wave (~130ms @10k, bench round 12b).
   */
  readonly row: { readonly selected?: boolean };
};

export type SelectionOverlay = Record<string, SelectionOverlayEntry>;

export const joinSelected = (
  rowSelected: boolean | undefined,
  entry: SelectionOverlayEntry | undefined,
): boolean => (entry !== undefined ? entry.value : !!rowSelected);

/** Absent-key-safe overlay read (subscribes even while the key is absent). */
export const overlayEntry = (
  overlay: SelectionOverlay,
  id: string,
): SelectionOverlayEntry | undefined => (id in overlay ? overlay[id] : undefined);
