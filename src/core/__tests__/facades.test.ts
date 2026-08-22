import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { RecordMapFacade } from "../facades";

type Row = { id: string; value: number };

const setup = (initial: Record<string, Row>) => {
  const [record, setRecord] = createStore<Record<string, Row>>(initial);
  return { facade: new RecordMapFacade<Row>(record), setRecord };
};

describe("RecordMapFacade (core, headless)", () => {
  it("reads through the Map interface", () => {
    const { facade } = setup({ a: { id: "a", value: 1 }, b: { id: "b", value: 2 } });

    expect(facade.size).toBe(2);
    expect(facade.has("a")).toBe(true);
    expect(facade.has("zzz")).toBe(false);
    expect(facade.get("b")?.value).toBe(2);
    expect(facade.get("zzz")).toBeUndefined();
    expect([...facade.keys()]).toEqual(["a", "b"]);
    expect([...facade.values()].map((row) => row.value)).toEqual([1, 2]);
    expect([...facade].map(([key, row]) => `${key}:${row.value}`)).toEqual(["a:1", "b:2"]);

    const seen: string[] = [];
    facade.forEach((row, key, map) => {
      seen.push(`${key}:${row.value}`);
      expect(map).toBe(facade);
    });
    expect(seen).toEqual(["a:1", "b:2"]);
  });

  it("rejects every mutating Map method", () => {
    const { facade } = setup({});
    expect(() => facade.set()).toThrow(/read-only/);
    expect(() => facade.delete()).toThrow(/read-only/);
    expect(() => facade.clear()).toThrow(/read-only/);
    expect(() => facade.getOrInsert()).toThrow(/read-only/);
    expect(() => facade.getOrInsertComputed()).toThrow(/read-only/);
  });

  it("size and membership reads are reactive", () => {
    createRoot((dispose) => {
      const { facade, setRecord } = setup({ a: { id: "a", value: 1 } });
      const sizes: number[] = [];

      createEffect(
        () => facade.size,
        (size) => {
          sizes.push(size);
        },
      );
      flush();
      expect(sizes).toEqual([1]);

      setRecord((draft) => {
        draft.b = { id: "b", value: 2 };
        return undefined;
      });
      flush();
      expect(sizes).toEqual([1, 2]);
      dispose();
    });
  });

  it("get on an ABSENT key still subscribes (in-guard)", () => {
    // The projection absent-key footgun: a bare record[key] read of a missing
    // key does not subscribe inside derives. The facade guards every get with
    // `in`, so consumers re-run once the key materializes.
    createRoot((dispose) => {
      const { facade, setRecord } = setup({});
      const seen: (number | undefined)[] = [];

      createEffect(
        () => facade.get("late")?.value,
        (value) => {
          seen.push(value);
        },
      );
      flush();
      expect(seen).toEqual([undefined]);

      setRecord((draft) => {
        draft.late = { id: "late", value: 7 };
        return undefined;
      });
      flush();
      expect(seen).toEqual([undefined, 7]);
      dispose();
    });
  });

  it("does not re-run a per-key subscriber for unrelated rows", () => {
    createRoot((dispose) => {
      const { facade, setRecord } = setup({
        a: { id: "a", value: 1 },
        b: { id: "b", value: 2 },
      });
      let aRuns = 0;

      createEffect(
        () => facade.get("a")?.value,
        () => {
          aRuns++;
        },
      );
      flush();
      expect(aRuns).toBe(1);

      setRecord((draft) => {
        draft.b!.value = 99;
        return undefined;
      });
      flush();
      expect(aRuns).toBe(1);
      dispose();
    });
  });
});
