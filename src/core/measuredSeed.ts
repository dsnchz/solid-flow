/**
 * Every node row the flow adopts carries `measured` from the start (empty
 * until the DOM has measured it): the measuring pass's write-through is then
 * two leaf writes into an existing object, never a replaced slot that
 * rebuilds the row projection (bench round 38: 193 -> 2 ms per 10k pass).
 *
 * Seeded where rows are still plain objects — the uncontrolled copy, the
 * node store factories, `addNodes` — because a write into rows the flow has
 * already adopted costs a rebuild per row (the very cost this removes). A
 * row from a raw user store gets the key on its first measurement instead.
 */
export const seedMeasured = <T extends { measured?: { width?: number; height?: number } }>(
  row: T,
): T => (row.measured ? row : { ...row, measured: {} });
