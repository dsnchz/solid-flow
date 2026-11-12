// @vitest-environment node
import type { Rect } from "@xyflow/system";
import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createCullPins } from "../cullPins";
import { createGeometryFeed } from "../geometryFeed";
import { createMountedIds } from "../projections/mountedIds";
import { createOnScreenIds } from "../projections/onScreenIds";

// The unmount tier's mounted list filters the id list against two plain sets
// (on-screen membership, cull pins) and must not re-run per geometry report:
// a list that re-read every row per change measured 5x slower than per-row
// gates (bench round 6).
const setup = () => {
  const feed = createGeometryFeed<Rect>();
  const pins = createCullPins("test");
  const [viewport, setViewport] = createSignal<Rect | null>(
    { x: 0, y: 0, width: 200, height: 200 },
    { ownedWrite: true },
  );
  const [active, setActive] = createSignal(true, { ownedWrite: true });
  const [focusedId, setFocusedId] = createSignal<string | null>(null, { ownedWrite: true });
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
  const ids = ["a", "b", "c", "d"];
  const runs = { count: 0 };
  const mounted = createMountedIds(
    {
      get ids() {
        runs.count++;
        return ids;
      },
      get active() {
        return active();
      },
      onScreen,
      pins,
      get focusedId() {
        return focusedId();
      },
    },
    "test.mounted",
  );
  for (const [i, id] of ids.entries())
    feed.report(id, { x: i % 2 ? 5000 : 0, y: i * 10, width: 50, height: 10 });
  return { feed, pins, setViewport, setActive, setFocusedId, mounted, runs };
};

describe("createMountedIds", () => {
  it("lists every id while inactive, else the on-screen, pinned and focused ids in array order", () => {
    createRoot((dispose) => {
      const { pins, setActive, setFocusedId, mounted } = setup();
      flush();
      expect(mounted()).toEqual(["a", "c"]);

      pins.set("d", true);
      flush();
      expect(mounted()).toEqual(["a", "c", "d"]);
      setFocusedId("b");
      flush();
      expect(mounted()).toEqual(["a", "b", "c", "d"]);
      pins.set("d", false);
      setFocusedId(null);
      flush();
      expect(mounted()).toEqual(["a", "c"]);

      setActive(false);
      flush();
      expect(mounted()).toEqual(["a", "b", "c", "d"]);
      dispose();
    });
  });

  it("re-runs on a membership or pin flip, not on a report that flips nothing", () => {
    createRoot((dispose) => {
      const { feed, pins, setViewport, mounted, runs } = setup();
      flush();
      mounted();
      const before = runs.count;

      feed.report("a", { x: 20, y: 0, width: 50, height: 10 }); // moves, stays on screen
      pins.set("a", false); // already unpinned
      flush();
      mounted();
      expect(runs.count).toBe(before);

      feed.report("b", { x: 10, y: 10, width: 50, height: 10 }); // comes on screen
      flush();
      expect(mounted()).toEqual(["a", "b", "c"]);
      expect(runs.count).toBe(before + 1);

      setViewport({ x: 4900, y: 0, width: 300, height: 200 });
      flush();
      expect(mounted()).toEqual(["d"]);
      dispose();
    });
  });
});
