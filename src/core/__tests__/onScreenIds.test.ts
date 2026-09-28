// @vitest-environment node
import type { Rect } from "@xyflow/system";
import { createEffect, createRoot, createSignal, flush, untrack } from "solid-js";
import { describe, expect, it } from "vitest";

import { createGeometryFeed } from "../geometryFeed";
import { createOnScreenIds, type OnScreenIds } from "../projections/onScreenIds";

// On-screen membership is computed from the plain geometry map: a full pass
// when the culling viewport steps, only the reported ids when geometry
// changes. Each row reads its own boolean signal, so a viewport step touches
// the rows that flip and nothing else (bench round 26: 50-66 ms frames on a
// 10k pane drag), and there is no keyed store record for the engine to fold
// on every step (round 50: ~4 us per present key, ~4 ms per pan step @10k).
const setup = () => {
  const feed = createGeometryFeed<Rect>();
  // stands in for the flow's culling memo; written from inside the test root
  const [viewport, setViewport] = createSignal<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null, { ownedWrite: true });
  const onScreen = createOnScreenIds(
    {
      geometry: feed.map,
      get cullingViewport() {
        return viewport();
      },
      changes: feed.changes,
      takeChanged: feed.takeChanged,
    },
    "test",
  );
  return { feed, setViewport, onScreen };
};

/** The subset of `ids` the membership reports on screen (untracked reads). */
const members = (onScreen: OnScreenIds, ids: readonly string[]) =>
  untrack(() => ids.filter((id) => onScreen.has(id)));

describe("createOnScreenIds", () => {
  it("reports nothing while the viewport is null, then exactly the overlapping ids after a step", () => {
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      feed.report("a", { x: 0, y: 0, width: 100, height: 40 });
      feed.report("b", { x: 5000, y: 5000, width: 100, height: 40 });
      feed.report("c", { x: 190, y: 0, width: 100, height: 40 }); // touches the edge
      flush();
      expect(members(onScreen, ["a", "b", "c"])).toEqual([]);
      setViewport({ x: 0, y: 0, width: 200, height: 200 });
      flush();
      expect(members(onScreen, ["a", "b", "c"])).toEqual(["a", "c"]);
      setViewport({ x: 4900, y: 4900, width: 200, height: 200 });
      flush();
      expect(members(onScreen, ["a", "b", "c"])).toEqual(["b"]);
      setViewport(null);
      flush();
      expect(members(onScreen, ["a", "b", "c"])).toEqual([]);
      dispose();
    });
  });

  it("follows a geometry change for the reported id only (no viewport step)", () => {
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      feed.report("a", { x: 0, y: 0, width: 100, height: 40 });
      feed.report("b", { x: 5000, y: 5000, width: 100, height: 40 });
      setViewport({ x: 0, y: 0, width: 200, height: 200 });
      flush();
      let aRuns = 0;
      const aSeen: boolean[] = [];
      createEffect(
        () => onScreen.has("a"),
        (on) => {
          aRuns++;
          aSeen.push(on);
        },
      );
      flush();
      expect(aSeen).toEqual([true]);
      // b moves on screen: b flips, a's subscriber is untouched
      feed.report("b", { x: 50, y: 50, width: 100, height: 40 });
      flush();
      expect(members(onScreen, ["a", "b"])).toEqual(["a", "b"]);
      expect(aRuns).toBe(1);
      // a moves away, then b is removed
      feed.report("a", { x: 9000, y: 0, width: 100, height: 40 });
      flush();
      expect(members(onScreen, ["a", "b"])).toEqual(["b"]);
      expect(aSeen).toEqual([true, false]);
      feed.report("b", null);
      flush();
      expect(members(onScreen, ["a", "b"])).toEqual([]);
      dispose();
    });
  });

  it("a viewport step re-runs only the rows that flip, in the same flush", () => {
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      for (let i = 0; i < 50; i++)
        feed.report(`n${i}`, { x: i * 100, y: 0, width: 80, height: 40 });
      setViewport({ x: 0, y: 0, width: 250, height: 100 });
      flush();
      const runs: Record<string, number> = {};
      const last: Record<string, boolean> = {};
      for (let i = 0; i < 50; i++)
        createEffect(
          () => onScreen.has(`n${i}`),
          (on) => {
            runs[`n${i}`] = (runs[`n${i}`] ?? 0) + 1;
            last[`n${i}`] = on;
          },
        );
      flush();
      setViewport({ x: 100, y: 0, width: 250, height: 100 }); // n0 leaves, n3 enters
      flush();
      const reran = Object.entries(runs)
        .filter(([, n]) => n > 1)
        .map(([id]) => id)
        .sort();
      expect(reran).toEqual(["n0", "n3"]);
      expect(last.n0).toBe(false);
      expect(last.n3).toBe(true);
      dispose();
    });
  });

  it("a subscriber holds across its row leaving and returning", () => {
    // An edge row goes null (endpoint unmeasured again) and comes back: a
    // reader that stayed subscribed through the gap must see the return.
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      feed.report("e", { x: 0, y: 0, width: 10, height: 10 });
      setViewport({ x: 0, y: 0, width: 200, height: 200 });
      flush();
      const seen: boolean[] = [];
      createEffect(
        () => onScreen.has("e"),
        (on) => {
          seen.push(on);
        },
      );
      flush();
      feed.report("e", null);
      flush();
      feed.report("e", { x: 20, y: 20, width: 10, height: 10 });
      flush();
      expect(seen).toEqual([true, false, true]);
      dispose();
    });
  });

  it("a reader created after its subscribers were disposed reads the current membership", () => {
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      feed.report("a", { x: 0, y: 0, width: 10, height: 10 });
      setViewport({ x: 0, y: 0, width: 200, height: 200 });
      flush();
      const first: boolean[] = [];
      const disposeFirst = createRoot((d) => {
        createEffect(
          () => onScreen.has("a"),
          (on) => {
            first.push(on);
          },
        );
        return d;
      });
      flush();
      expect(first).toEqual([true]);
      disposeFirst();
      flush();
      // flips while nobody is subscribed
      setViewport({ x: 4000, y: 4000, width: 200, height: 200 });
      flush();
      const second: boolean[] = [];
      createEffect(
        () => onScreen.has("a"),
        (on) => {
          second.push(on);
        },
      );
      flush();
      setViewport({ x: 0, y: 0, width: 200, height: 200 });
      flush();
      expect(second).toEqual([false, true]);
      dispose();
    });
  });

  it("answers an untracked read from the current membership", () => {
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      feed.report("a", { x: 0, y: 0, width: 10, height: 10 });
      feed.report("b", { x: 5000, y: 0, width: 10, height: 10 });
      setViewport({ x: 0, y: 0, width: 200, height: 200 });
      flush();
      expect(untrack(() => onScreen.has("a"))).toBe(true);
      expect(untrack(() => onScreen.has("b"))).toBe(false);
      expect(untrack(() => onScreen.has("missing"))).toBe(false);
      dispose();
    });
  });
});

describe("createGeometryFeed", () => {
  it("stores rects, drains the changed ids once, and bumps the tick on every report", () => {
    // Per report, not per batch (bench round 41): the selected-nodes bounds
    // sample the map on the tick and never drain, so every change must wake them.
    createRoot((dispose) => {
      const feed = createGeometryFeed<Rect>();
      const before = feed.changes();
      feed.report("a", { x: 1, y: 2, width: 3, height: 4 });
      feed.report("b", { x: 0, y: 0, width: 1, height: 1 });
      feed.report("b", null);
      flush();
      expect(feed.map.get("a")).toEqual({ x: 1, y: 2, width: 3, height: 4 });
      expect(feed.map.has("b")).toBe(false);
      expect(feed.changes()).toBe(before + 3);
      expect([...feed.takeChanged()].sort()).toEqual(["a", "b"]);
      expect(feed.takeChanged().size).toBe(0);
      feed.report("c", { x: 0, y: 0, width: 1, height: 1 });
      flush();
      expect(feed.changes()).toBe(before + 4);
      dispose();
    });
  });
});
