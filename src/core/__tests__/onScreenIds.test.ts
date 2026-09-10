// @vitest-environment node
import type { Rect } from "@xyflow/system";
import { createEffect, createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createGeometryFeed } from "../geometryFeed";
import { createOnScreenIds } from "../projections/onScreenIds";

// On-screen membership is computed from the plain geometry map: a full pass
// when the culling viewport steps, only the reported ids when geometry
// changes. Rows subscribe per key, so a viewport step touches the rows that
// flip and nothing else (bench round 26: 50-66 ms frames on a 10k pane drag).
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

describe("createOnScreenIds", () => {
  it("is empty while the viewport is null, then holds exactly the overlapping ids after a step", () => {
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      feed.report("a", { x: 0, y: 0, width: 100, height: 40 });
      feed.report("b", { x: 5000, y: 5000, width: 100, height: 40 });
      feed.report("c", { x: 190, y: 0, width: 100, height: 40 }); // touches the edge
      flush();
      expect(Object.keys(onScreen)).toEqual([]);
      setViewport({ x: 0, y: 0, width: 200, height: 200 });
      flush();
      expect(Object.keys(onScreen).sort()).toEqual(["a", "c"]);
      setViewport({ x: 4900, y: 4900, width: 200, height: 200 });
      flush();
      expect(Object.keys(onScreen)).toEqual(["b"]);
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
      expect(Object.keys(onScreen)).toEqual(["a"]);
      let aRuns = 0;
      createEffect(
        () => "a" in onScreen,
        () => {
          aRuns++;
        },
      );
      flush();
      // b moves on screen: b's key appears, a's subscriber is untouched
      feed.report("b", { x: 50, y: 50, width: 100, height: 40 });
      flush();
      expect(Object.keys(onScreen).sort()).toEqual(["a", "b"]);
      expect(aRuns).toBe(1);
      // a moves away, then is removed
      feed.report("a", { x: 9000, y: 0, width: 100, height: 40 });
      flush();
      expect(Object.keys(onScreen)).toEqual(["b"]);
      expect(aRuns).toBe(2);
      feed.report("b", null);
      flush();
      expect(Object.keys(onScreen)).toEqual([]);
      dispose();
    });
  });

  it("a viewport step re-runs only the rows that flip", () => {
    createRoot((dispose) => {
      const { feed, setViewport, onScreen } = setup();
      for (let i = 0; i < 50; i++)
        feed.report(`n${i}`, { x: i * 100, y: 0, width: 80, height: 40 });
      setViewport({ x: 0, y: 0, width: 250, height: 100 });
      flush();
      const runs: Record<string, number> = {};
      for (let i = 0; i < 50; i++)
        createEffect(
          () => `n${i}` in onScreen,
          () => {
            runs[`n${i}`] = (runs[`n${i}`] ?? 0) + 1;
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
      dispose();
    });
  });
});

describe("createGeometryFeed", () => {
  it("stores rects, drains the changed ids once, and bumps the tick once per batch", () => {
    createRoot((dispose) => {
      const feed = createGeometryFeed<Rect>();
      const before = feed.changes();
      feed.report("a", { x: 1, y: 2, width: 3, height: 4 });
      feed.report("b", { x: 0, y: 0, width: 1, height: 1 });
      feed.report("b", null);
      flush();
      expect(feed.map.get("a")).toEqual({ x: 1, y: 2, width: 3, height: 4 });
      expect(feed.map.has("b")).toBe(false);
      expect(feed.changes()).toBe(before + 1);
      expect([...feed.takeChanged()].sort()).toEqual(["a", "b"]);
      expect(feed.takeChanged().size).toBe(0);
      feed.report("c", { x: 0, y: 0, width: 1, height: 1 });
      flush();
      expect(feed.changes()).toBe(before + 2);
      dispose();
    });
  });
});
