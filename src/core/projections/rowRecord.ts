import { type Accessor, createProjection, type Owner, runWithOwner } from "solid-js";

/**
 * A record slot value the engine serves RAW: frozen objects are not
 * wrappable, so the getter hands out the row store's own proxy. Assigning the
 * row proxy itself would be unwrapped on write and re-wrapped under the
 * record's projection family on read — every nested leaf a consumer then
 * touched (`measured.width`, `internals.positionAbsolute`, ...) would be a
 * signal owned by the long-lived record rather than the row, and deleting the
 * row would leave those signals (and their last values) attached to the
 * record for the flow's lifetime (bench round 20: ~26 KB retained per deleted
 * node+edge pair @10k). `store` is the row store itself, for readers of the
 * store's own leaves next to `row`.
 */
export type RowHolder<Row, Store = unknown> = { readonly row: Row | null; readonly store: Store };

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
 * ~25-line block lived verbatim in internalNodes AND resolvedEdges and had
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
): Record<string, Row> => createRecordFacade(createRowHolders(rowStores, name));

/**
 * The holder record behind createRowRecordProjection, for a caller that also
 * reads the row stores' own leaves: `holders[id].store` is a tracked read of
 * the id's slot (a re-created row store repoints it), then the store.
 */
export const createRowHolders = <Row extends object, Store extends { readonly row: Row | null }>(
  rowStores: () => readonly { readonly id: string; readonly store: Store }[],
  name: string,
): Record<string, RowHolder<Row, Store>> => {
  const holderOf = new WeakMap<Store, RowHolder<Row, Store>>();
  const assigned = new Map<string, RowHolder<Row, Store>>();
  return createProjection<Record<string, RowHolder<Row, Store>>>(
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
            store,
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
};

/**
 * One row's registration: its item accessor and its row store, created on
 * the first read of `store` under the row's own owner. A row is COLD until
 * then (#22): nothing derives it, and a cold reporter of its own (see the
 * callers) keeps the plain geometry and cull-pin sets current. Reading the
 * store turns it HOT for the rest of its life.
 */
export class RowEntry<Item, Store> {
  created: Store | undefined;
  readonly #owner: Owner | null;
  readonly #create: () => Store;

  constructor(
    readonly id: string,
    readonly item: Accessor<Item>,
    owner: Owner | null,
    create: () => Store,
  ) {
    this.#owner = owner;
    this.#create = create;
  }

  get store(): Store {
    return (this.created ??= runWithOwner(this.#owner, this.#create));
  }
}

/**
 * The holder record over row ENTRIES (not row stores): one frozen holder per
 * entry, present while the entry is, whether or not its row is null or even
 * created. Building it reads no row, so it heats nothing; `holder.row` and
 * `holder.store` create the row on first read (createRecordFacade reads
 * `row`). A same-id replacement is a new entry and repoints the slot.
 * `heat` names the entries that must be created anyway (tracked: it re-runs
 * the record on whatever it reads).
 */
export const createEntryHolders = <
  Row extends object,
  Store extends { readonly row: Row | null },
  Entry extends RowEntry<unknown, Store>,
>(
  entries: () => readonly Entry[],
  name: string,
  heat?: (entry: Entry) => boolean,
): Record<string, RowHolder<Row, Store>> => {
  const holderOf = new WeakMap<Entry, RowHolder<Row, Store>>();
  const assigned = new Map<string, RowHolder<Row, Store>>();
  return createProjection<Record<string, RowHolder<Row, Store>>>(
    (draft) => {
      const seen = new Set<string>();
      for (const entry of entries()) {
        const { id } = entry;
        seen.add(id);
        if (heat?.(entry)) void entry.store;
        let holder = holderOf.get(entry);
        if (holder === undefined) {
          holder = Object.freeze({
            get row() {
              return entry.store.row;
            },
            get store() {
              return entry.store;
            },
          });
          holderOf.set(entry, holder);
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
};
