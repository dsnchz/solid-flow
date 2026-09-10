// @vitest-environment node
import { createEffect, createProjection, createRoot, createStore, flush, mapArray } from "solid-js";
import { describe, expect, it } from "vitest";

import { createRowRecordProjection } from "../projections/rowRecord";

type Source = { id: string; x: number; live: boolean };
type Row = { id: string; x: number };

// A keyed record over per-row projection stores (the internalNodes /
// layoutedEdges shape): the record must hand out each row store's OWN proxy.
// Re-wrapping the row under the record's projection family would attach every
// nested leaf signal a consumer reads to the long-lived record instead of the
// row, so deleted rows would stay reachable for the record's lifetime
// (bench round 20).
const setup = (initial: Source[]) =>
  createRoot(() => {
    const [rows, setRows] = createStore<Source[]>(initial);
    const rowStores = mapArray(
      () => rows,
      (rowAccessor) => {
        const id = rowAccessor().id;
        const store: { row: Row | null } = createProjection<{ row: Row | null }>(
          () => {
            const source = rowAccessor();
            return { row: source.live ? { id: source.id, x: source.x } : null };
          },
          { row: null },
          { key: "id" },
        );
        return { id, store };
      },
      { keyed: (row) => row.id },
    );
    const record = createRowRecordProjection(rowStores, "testRecord");
    flush();
    return { rows, setRows, rowStores, record };
  });

describe("createRowRecordProjection", () => {
  it("serves each row store's own proxy — never a re-wrapped copy", () => {
    const { rowStores, record } = setup([
      { id: "a", x: 1, live: true },
      { id: "b", x: 2, live: true },
    ]);
    const [a, b] = rowStores();
    expect(record.a).toBe(a!.store.row);
    expect(record.b).toBe(b!.store.row);
    expect(record.a?.x).toBe(1);
  });

  it("keys follow presence: null rows are absent, flips add and remove the key", () => {
    const { setRows, rowStores, record } = setup([
      { id: "a", x: 1, live: true },
      { id: "b", x: 2, live: false },
    ]);
    expect(Object.keys(record)).toEqual(["a"]);
    expect("b" in record).toBe(false);
    expect(record.b).toBeUndefined();

    setRows((draft) => {
      draft[1]!.live = true;
    });
    flush();
    expect(Object.keys(record).sort()).toEqual(["a", "b"]);
    expect(record.b).toBe(rowStores()[1]!.store.row);

    setRows((draft) => {
      draft[0]!.live = false;
    });
    flush();
    expect(Object.keys(record)).toEqual(["b"]);
    expect("a" in record).toBe(false);
  });

  it("removing a source row deletes its key", () => {
    const { setRows, record } = setup([
      { id: "a", x: 1, live: true },
      { id: "b", x: 2, live: true },
    ]);
    setRows((draft) => {
      draft.splice(0, 1);
    });
    flush();
    expect(Object.keys(record)).toEqual(["b"]);
    expect(record.a).toBeUndefined();
  });

  it("subscribes per key: a row's leaf write re-runs only that key's reader", () => {
    const { setRows, record } = setup([
      { id: "a", x: 1, live: true },
      { id: "b", x: 2, live: true },
    ]);
    let aRuns = 0;
    let bRuns = 0;
    createRoot(() => {
      createEffect(
        () => record.a?.x,
        () => {
          aRuns++;
        },
      );
      createEffect(
        () => record.b?.x,
        () => {
          bRuns++;
        },
      );
    });
    flush();
    expect([aRuns, bRuns]).toEqual([1, 1]);
    setRows((draft) => {
      draft[0]!.x = 10;
    });
    flush();
    expect(record.a?.x).toBe(10);
    expect([aRuns, bRuns]).toEqual([2, 1]);
  });
});
