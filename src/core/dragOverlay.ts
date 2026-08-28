import type { XYPosition } from "@xyflow/system";

/**
 * Drag-position sidecar (the solid#3085 composition, position slice):
 * per-frame gesture positions live in this flow-owned keyed overlay, joined
 * with user rows at read time; the per-frame row write-through stays for the
 * parity contract (a plain store is live during a drag).
 *
 * Precedence is VALUE-BASED — positions are rich enough for it (unlike the
 * selection booleans): `rowBefore` is the row's position when the gesture
 * first touched it. A row sitting at `rowBefore` means the write-through
 * reverted (optimistic store) — the overlay governs. A row sitting at the
 * overlay's own position means the write-through landed — both agree. Any
 * OTHER row value is a genuine user/reconcile write — the row governs.
 * The release effect (createFlowState) additionally deletes confirmed
 * entries post-gesture so an undo to the exact pre-drag position works on
 * plain stores.
 */
export type DragOverlayEntry = {
  readonly position: XYPosition;
  readonly dragging: boolean;
  readonly rowBefore: XYPosition;
  /** Row proxy captured at write time — see SelectionOverlayEntry.row. */
  readonly row: { readonly position: XYPosition };
};

export type DragOverlay = Record<string, DragOverlayEntry>;

const samePos = (a: XYPosition | undefined, b: XYPosition): boolean =>
  !!a && a.x === b.x && a.y === b.y;

export const joinPosition = (
  rowPosition: XYPosition,
  entry: DragOverlayEntry | undefined,
): XYPosition => {
  if (entry === undefined) return rowPosition;
  return samePos(rowPosition, entry.rowBefore) || samePos(rowPosition, entry.position)
    ? entry.position
    : rowPosition;
};

export const joinDragging = (
  rowDragging: boolean | undefined,
  entry: DragOverlayEntry | undefined,
): boolean => (entry !== undefined ? entry.dragging : !!rowDragging);

/** Absent-key-safe overlay read (subscribes even while the key is absent). */
export const dragEntry = (overlay: DragOverlay, id: string): DragOverlayEntry | undefined =>
  id in overlay ? overlay[id] : undefined;
