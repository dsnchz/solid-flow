// @vitest-environment node
import type { Rect, Transform } from "@xyflow/system";
import { createMemo, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { InternalNode, Node } from "@/types";

import { createCullingViewport, edgeCulled, nodeCulled, rectsOverlap } from "../culling";

const makeInternalNode = (
  overrides: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    selected?: boolean;
    measured?: boolean;
    mounted?: boolean;
    cullable?: boolean;
  } = {},
): InternalNode => {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 50,
    selected = false,
    measured = true,
    mounted = true,
    cullable,
  } = overrides;
  const node: Node = { id: "n", position: { x, y }, data: {}, selected, cullable };
  return {
    ...node,
    measured: measured ? { width, height } : {},
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userNode: node,
      // Handle bounds only populate on first mount in this flow instance.
      handleBounds: mounted ? { source: [], target: [] } : undefined,
    },
  } as InternalNode;
};

// A 800x600 container at zoom 1 centered on the origin-anchored viewport:
// culling rect spans [-400, 1200] x [-300, 900] (bucketed dims + 0.5 overscan).
const makeSource = (initial: { width?: number; height?: number; transform?: Transform } = {}) => {
  const [state, setState] = createStore({
    width: initial.width ?? 800,
    height: initial.height ?? 600,
    transform: initial.transform ?? ([0, 0, 1] as Transform),
  });
  return {
    setTransform: (transform: Transform) => {
      setState((draft) => {
        draft.transform = transform;
      });
    },
    setState,
    source: {
      get width() {
        return state.width;
      },
      get height() {
        return state.height;
      },
      get transform() {
        return state.transform;
      },
    },
  };
};

describe("createCullingViewport (core, headless)", () => {
  it("is null while the container is unmeasured, and stays null across pans", () => {
    const { setTransform, source } = makeSource({ width: 0, height: 0 });
    // Graph construction under the root; writes and reads from mainline
    // (rc.9: a root body is an owned scope, writes there throw in dev).
    const runs = { count: 0 };
    const { rect, dispose } = createRoot((dispose) => {
      const cullingViewport = createCullingViewport(source);
      const rect = createMemo(() => {
        runs.count++;
        return cullingViewport();
      });
      return { rect, dispose };
    });
    flush();
    expect(rect()).toBeNull();
    expect(runs.count).toBe(1);

    // Geometry changes must not recompute the unmeasured memo's consumers
    // (null-equals-null holds through the rect equality).
    setTransform([-100, -50, 1]);
    flush();
    expect(rect()).toBeNull();
    expect(runs.count).toBe(1);
    dispose();
  });

  it("always covers the actual visible rect (property sweep)", () => {
    const { setTransform, setState, source } = makeSource();
    const { cullingViewport, dispose } = createRoot((dispose) => ({
      cullingViewport: createCullingViewport(source),
      dispose,
    }));
    // Deterministic pseudo-random sweep over pans and zooms.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 200; i++) {
      const zoom = 0.3 + rand() * 3.7;
      const tx = (rand() - 0.5) * 10000;
      const ty = (rand() - 0.5) * 10000;
      setTransform([tx, ty, zoom]);
      setState((draft) => {
        draft.width = 400 + Math.floor(rand() * 1200);
      });
      flush();

      const { width, height } = source;
      const visible: Rect = {
        x: -tx / zoom,
        y: -ty / zoom,
        width: width / zoom,
        height: height / zoom,
      };
      const rect = cullingViewport()!;
      expect(rect.x).toBeLessThanOrEqual(visible.x);
      expect(rect.y).toBeLessThanOrEqual(visible.y);
      expect(rect.x + rect.width).toBeGreaterThanOrEqual(visible.x + visible.width);
      expect(rect.y + rect.height).toBeGreaterThanOrEqual(visible.y + visible.height);
    }
    dispose();
  });

  it("holds its value (and downstream memos) while panning inside the quantization step", () => {
    const { setTransform, source } = makeSource();
    const runs = { count: 0 };
    const { dependent, dispose } = createRoot((dispose) => {
      const cullingViewport = createCullingViewport(source);
      const dependent = createMemo(() => {
        runs.count++;
        return cullingViewport();
      });
      return { dependent, dispose };
    });
    flush();
    const initial = dependent();
    expect(initial).not.toBeNull();
    expect(runs.count).toBe(1);

    // Step is 0.25 * 800 = 200 flow units; a 30px pan stays inside it.
    setTransform([-30, -10, 1]);
    flush();
    expect(dependent()).toBe(initial);
    expect(runs.count).toBe(1);

    // A pan past the step crosses a quantization boundary.
    setTransform([-450, 0, 1]);
    flush();
    expect(dependent()).not.toBe(initial);
    expect(runs.count).toBe(2);
    dispose();
  });
});

describe("rectsOverlap", () => {
  it("detects overlap, touching edges, and disjoint rects", () => {
    const a: Rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(rectsOverlap(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true);
    expect(rectsOverlap(a, { x: 100, y: 0, width: 100, height: 100 })).toBe(true);
    expect(rectsOverlap(a, { x: 101, y: 0, width: 100, height: 100 })).toBe(false);
  });
});

// Row-level rules over the on-screen membership (bench rounds 26 and 52):
// the never-cull guards stay at the row; the rect overlap lives in the
// membership, which the rows ask per id.
describe("nodeCulled / edgeCulled (on-screen membership)", () => {
  const none: ReadonlySet<string> = new Set();
  const onScreen: ReadonlySet<string> = new Set(["n"]);
  it("culls a measured, mounted, unselected node that is not on screen", () => {
    expect(nodeCulled(makeInternalNode(), true, none)).toBe(true);
    expect(nodeCulled(makeInternalNode(), true, onScreen)).toBe(false);
  });
  it("never culls while culling is inactive, or selected / cullable:false / unmeasured / unmounted nodes", () => {
    expect(nodeCulled(makeInternalNode(), false, none)).toBe(false);
    expect(nodeCulled(makeInternalNode({ selected: true }), true, none)).toBe(false);
    expect(nodeCulled(makeInternalNode({ cullable: false }), true, none)).toBe(false);
    expect(nodeCulled(makeInternalNode({ measured: false }), true, none)).toBe(false);
    expect(nodeCulled(makeInternalNode({ mounted: false }), true, none)).toBe(false);
  });
  it("edges: culled when not on screen, never when inactive / selected / cullable:false", () => {
    const row = {
      id: "e",
      sourceX: 0,
      sourceY: 0,
      targetX: 10,
      targetY: 10,
      selected: false,
      cullable: undefined,
    };
    expect(edgeCulled(row, true, none)).toBe(true);
    expect(edgeCulled(row, true, new Set(["e"]))).toBe(false);
    expect(edgeCulled(row, false, none)).toBe(false);
    expect(edgeCulled({ ...row, selected: true }, true, none)).toBe(false);
    expect(edgeCulled({ ...row, cullable: false }, true, none)).toBe(false);
  });
});
