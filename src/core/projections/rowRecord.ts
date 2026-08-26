import { createProjection } from "solid-js";

/**
 * The shared tail of the keyed-row projections (audit C2a — this exact
 * ~25-line block lived verbatim in internalNodes AND layoutedEdges and had
 * already diverged once): a SHALLOW public record holding each present row's
 * proxy by reference. Row-content reads chain into the row stores, so this
 * computed updates only when membership or presence changes
 * (present→present content updates merge into the same backing object).
 * Slots are re-assigned by ROW-PROXY reference, so a same-id replacement
 * (array reset recreates the row store) repoints the slot instead of leaving
 * it on a disposed store. Draft form: removed ids must be deleted explicitly
 * (assigning undefined would keep the own key — spike 09).
 *
 * Rows may be `null` while not present (unready endpoints, culled) — null
 * rows are simply absent from the record.
 */
export const createRowRecordProjection = <Row extends object>(
  rowStores: () => readonly { readonly id: string; readonly store: { readonly row: Row | null } }[],
): Record<string, Row> => {
  const assigned = new Map<string, Row>();
  return createProjection<Record<string, Row>>(
    (draft) => {
      const seen = new Set<string>();
      for (const { id, store } of rowStores()) {
        const row = store.row;
        if (!row) continue;
        seen.add(id);
        if (assigned.get(id) !== row) {
          assigned.set(id, row);
          draft[id] = row;
        }
      }
      for (const id of assigned.keys()) {
        if (!seen.has(id)) {
          assigned.delete(id);
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
          delete draft[id];
        }
      }
    },
    {},
    { key: null, shallow: true },
  );
};
