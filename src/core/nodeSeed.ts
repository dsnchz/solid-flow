/**
 * Every node row the flow adopts carries the flow-owned keys from the start:
 * `measured` (empty until the DOM has measured it) and `selected` /
 * `dragging` (`false`). The measuring pass's write-through is then two leaf
 * writes into an existing object, never a replaced slot that rebuilds the
 * row projection (bench round 38: 193 -> 2 ms per 10k pass). The two
 * booleans are seeded as explicit STATE (user decision, 2026-09-26): a fresh
 * row reads `selected: false`, not "not written yet" — measured to make no
 * performance difference (bench round 43), kept for the unambiguous shape.
 *
 * Seeded where rows are still plain objects — the uncontrolled copy, the
 * node store factories, `addNodes` — because a write into rows the flow has
 * already adopted costs a rebuild per row. A row from a raw user store gets
 * the keys on their first write instead. A value the user supplied is kept.
 */
export const seedNodeRow = <
  T extends {
    measured?: { width?: number; height?: number };
    selected?: boolean;
    dragging?: boolean;
  },
>(
  row: T,
): T => {
  if (row.measured && row.selected !== undefined && row.dragging !== undefined) return row;
  return {
    ...row,
    measured: row.measured ?? {},
    selected: row.selected ?? false,
    dragging: row.dragging ?? false,
  };
};
