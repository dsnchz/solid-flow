// @vitest-environment node
import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createRowIndex } from "../rowIndex";

type Row = { id: string; v: number };

/** Rows behind a Proxy that counts element reads (draft-proxy trap stand-in). */
const countingRows = (rows: Row[]) => {
  const counts = { elements: 0, scans: 0 };
  const proxy = new Proxy(rows, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) counts.elements++;
      if (prop === "find" || prop === "findIndex" || prop === Symbol.iterator) counts.scans++;
      return Reflect.get(target, prop, receiver);
    },
  });
  return { proxy, counts };
};

const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, v: i }));

describe("createRowIndex", () => {
  it("resolves k ids among n rows with O(k) element reads and no scan", () => {
    const list = rows(1000);
    const { proxy, counts } = countingRows(list);
    createRoot(() => {
      const index = createRowIndex<Row>(() => list.map((r) => r.id));

      expect(index.get(proxy, "n7")).toBe(list[7]);
      expect(index.get(proxy, "n519")).toBe(list[519]);
      expect(index.indexOf(proxy, "n999")).toBe(999);
    });
    expect(counts.scans).toBe(0);
    // two element reads per `get` (guard + return), one per `indexOf`
    expect(counts.elements).toBeLessThanOrEqual(5);
  });

  it("returns -1 / undefined for unknown ids (via the scan floor)", () => {
    const list = rows(10);
    createRoot(() => {
      const index = createRowIndex<Row>(() => list.map((r) => r.id));
      expect(index.indexOf(list, "nope")).toBe(-1);
      expect(index.get(list, "nope")).toBeUndefined();
    });
  });

  it("falls back to a scan when the index lags the rows (same-batch membership write)", () => {
    // The ids accessor lags the rows: a row was inserted at the front after
    // the index last computed (writes commit at flush). The slot guard
    // catches the mismatch and the resolver still finds the right row; the
    // not-yet-indexed row is found by the scan floor.
    const list = rows(5);
    createRoot(() => {
      const [ids] = createSignal(list.map((r) => r.id));
      const index = createRowIndex<Row>(ids);
      expect(index.indexOf(list, "n3")).toBe(3);

      list.unshift({ id: "new", v: -1 });
      expect(index.indexOf(list, "n3")).toBe(4);
      expect(index.get(list, "n3")?.id).toBe("n3");
      expect(index.indexOf(list, "new")).toBe(0);
    });
  });

  it("follows the ids accessor across membership changes", () => {
    const list = rows(3);
    const [ids, setIds] = createSignal(list.map((r) => r.id));
    let index!: ReturnType<typeof createRowIndex<Row>>;
    createRoot(() => {
      index = createRowIndex<Row>(ids);
    });
    expect(index.indexOf(list, "n2")).toBe(2);

    // Writes happen outside the owned scope; the index follows at flush.
    list.reverse();
    setIds(list.map((r) => r.id));
    flush();
    expect(index.indexOf(list, "n2")).toBe(0);
    expect(index.indexOf(list, "n0")).toBe(2);
  });
});
