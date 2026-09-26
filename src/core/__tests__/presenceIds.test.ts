// @vitest-environment node
import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createPresenceIds } from "../projections/presenceIds";

type Row = { id: string; hidden?: boolean; w?: number };

/**
 * Keyed presence record over a predicate — the template behind selectedIds
 * and (now) the unmeasured-node set feeding `nodesInitialized`. The point is
 * the update shape: one row's change touches that row's key only, and a
 * row change that does not flip the predicate touches nothing.
 */
describe("createPresenceIds", () => {
  const setup = () => {
    const [rows, setRows] = createStore<Row[]>([
      { id: "a", w: 10 },
      { id: "b" },
      { id: "c", hidden: true },
    ]);
    let record!: Record<string, { id: string }>;
    let dispose!: () => void;
    const runs = { membership: 0 };
    createRoot((d) => {
      dispose = d;
      record = createPresenceIds(
        () => rows,
        (row) => !row.hidden && row.w === undefined,
        "unmeasured",
      );
      createEffect(
        () => Object.keys(record).length,
        () => {
          runs.membership++;
        },
      );
    });
    flush();
    return { rows, setRows, record: () => record, runs, dispose };
  };

  it("holds exactly the rows satisfying the predicate", () => {
    const { record, dispose } = setup();
    expect(Object.keys(record())).toEqual(["b"]);
    dispose();
  });

  it("a predicate flip on one row adds/removes only that key; membership subscribers see it", () => {
    const { setRows, record, runs, dispose } = setup();
    expect(runs.membership).toBe(1);
    setRows((draft) => {
      draft[1]!.w = 5;
    });
    flush();
    expect(Object.keys(record())).toEqual([]);
    expect(runs.membership).toBe(2);

    setRows((draft) => {
      draft[2]!.hidden = false;
    });
    flush();
    expect(Object.keys(record())).toEqual(["c"]);
    expect(runs.membership).toBe(3);
    dispose();
  });

  it("a row change that does not flip the predicate leaves the record untouched", () => {
    const { setRows, record, runs, dispose } = setup();
    const entryBefore = record().b;
    setRows((draft) => {
      draft[0]!.w = 99; // still measured
      draft[1]!.hidden = false; // still unmeasured (was undefined → false)
    });
    flush();
    expect(record().b).toBe(entryBefore);
    expect(runs.membership).toBe(1);
    dispose();
  });

  it("follows membership: added rows are evaluated, removed rows drop out", () => {
    const { setRows, record, dispose } = setup();
    setRows((draft) => {
      draft.push({ id: "d" });
    });
    flush();
    expect(Object.keys(record()).sort()).toEqual(["b", "d"]);
    setRows(() => [{ id: "a", w: 1 }]);
    flush();
    expect(Object.keys(record())).toEqual([]);
    dispose();
  });
});

/**
 * A whole-graph replacement with FRESH row objects of the same ids (bench
 * round 41, "set graph") must be a re-derive per row, not a dispose-and-
 * recreate: the map is keyed by id, so each row's presence projection (and
 * its `{ id }` entry) survives the swap, and an unflipped row stays silent.
 */
describe("createPresenceIds — same-id replacement", () => {
  const setup = () => {
    const [rows, setRows] = createStore<Row[]>([
      { id: "a", w: 10 },
      { id: "b" },
      { id: "c", hidden: true },
    ]);
    let record!: Record<string, { id: string }>;
    let dispose!: () => void;
    const runs = { membership: 0 };
    createRoot((d) => {
      dispose = d;
      record = createPresenceIds(
        () => rows,
        (row) => !row.hidden && row.w === undefined,
        "unmeasured",
      );
      createEffect(
        () => Object.keys(record).length,
        () => {
          runs.membership++;
        },
      );
    });
    flush();
    return { rows, setRows, record: () => record, runs, dispose };
  };

  it("keeps every entry's identity and stays silent when no row flips", () => {
    const { setRows, record, runs, dispose } = setup();
    const entryBefore = record().b;
    setRows(() => [{ id: "a", w: 10 }, { id: "b" }, { id: "c", hidden: true }]);
    flush();
    expect(Object.keys(record())).toEqual(["b"]);
    expect(record().b).toBe(entryBefore);
    expect(runs.membership).toBe(1);
    dispose();
  });

  it("re-derives each row against its fresh object: flips still land", () => {
    const { setRows, record, runs, dispose } = setup();
    setRows(() => [{ id: "a" }, { id: "b", w: 3 }, { id: "c", hidden: true }]);
    flush();
    expect(Object.keys(record())).toEqual(["a"]);
    expect(runs.membership).toBe(2);
    dispose();
  });
});
