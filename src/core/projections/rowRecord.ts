import { createProjection } from "solid-js";

/**
 * A record slot value the engine serves RAW: frozen objects are not
 * wrappable, so the getter hands out the row store's own proxy. Assigning the
 * row proxy itself would be unwrapped on write and re-wrapped under the
 * record's projection family on read — every nested leaf a consumer then
 * touched (`measured.width`, `internals.positionAbsolute`, ...) would be a
 * signal owned by the long-lived record rather than the row, and deleting the
 * row would leave those signals (and their last values) attached to the
 * record for the flow's lifetime (bench round 20: ~26 KB retained per deleted
 * node+edge pair @10k).
 */
export type RowHolder<Row> = { readonly row: Row | null };

/**
 * Read-only record view over a holder record: `facade[id]` is the row itself,
 * `id in facade` / `Object.keys(facade)` follow the holder record's keys.
 * Present keys read through the key's own slot (per-key subscription); the
 * `in` probe — which subscribes record-wide — runs only for absent keys, where
 * the appear-later subscription is the point (see RecordMapFacade.get).
 */
export const createRecordFacade = <Row extends object>(
  holders: Record<string, RowHolder<Row>>,
): Record<string, Row> =>
  new Proxy<Record<string, Row>>(
    {},
    {
      get(_, key) {
        if (typeof key !== "string") return Reflect.get(holders, key);
        const holder = holders[key];
        if (holder !== undefined) return holder.row ?? undefined;
        return key in holders ? (holders[key]?.row ?? undefined) : undefined;
      },
      has: (_, key) => key in holders,
      ownKeys: () => Object.keys(holders),
      getOwnPropertyDescriptor(_, key) {
        if (typeof key !== "string" || !(key in holders)) return undefined;
        return {
          enumerable: true,
          configurable: true,
          get: () => holders[key]?.row ?? undefined,
        };
      },
      // Writes belong to the roots the record derives from (mirrors the
      // engine: a write outside a draft is a silent no-op).
      set: () => true,
      deleteProperty: () => true,
    },
  );

/**
 * The shared tail of the keyed-row projections (audit C2a — this exact
 * ~25-line block lived verbatim in internalNodes AND layoutedEdges and had
 * already diverged once): a SHALLOW keyed projection holding one frozen
 * RowHolder per present row, exposed through createRecordFacade so consumers
 * read `record[id]` as the row store's own proxy. Row-content reads chain
 * into the row stores, so this computed updates only when membership or
 * presence changes (present→present content updates merge into the same
 * backing object). One holder per row STORE: a same-id replacement that
 * recreates the row store repoints the slot instead of leaving it on a
 * disposed store. Draft form: removed ids must be deleted explicitly
 * (assigning undefined would keep the own key — spike 09).
 *
 * Rows may be `null` while not present (unready endpoints, culled) — null
 * rows are simply absent from the record.
 */
export const createRowRecordProjection = <Row extends object>(
  rowStores: () => readonly { readonly id: string; readonly store: { readonly row: Row | null } }[],
  name = "rowRecord",
): Record<string, Row> => {
  const holderOf = new WeakMap<{ readonly row: Row | null }, RowHolder<Row>>();
  const assigned = new Map<string, RowHolder<Row>>();
  const holders = createProjection<Record<string, RowHolder<Row>>>(
    (draft) => {
      const seen = new Set<string>();
      for (const { id, store } of rowStores()) {
        if (!store.row) continue;
        seen.add(id);
        let holder = holderOf.get(store);
        if (holder === undefined) {
          holder = Object.freeze({
            get row() {
              return store.row;
            },
          });
          holderOf.set(store, holder);
        }
        if (assigned.get(id) !== holder) {
          assigned.set(id, holder);
          draft[id] = holder;
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
    { key: null, shallow: true, name },
  );
  return createRecordFacade(holders);
};
