// @vitest-environment node
import type { Rect, Transform } from "@xyflow/system";
import { createMemo, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { InternalNode, Node } from "@/types";

import { createCullingViewport, isEdgeCulled, isNodeCulled, rectsOverlap } from "../culling";

const makeInternalNode = (
  overrides: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    selected?: boolean;
    measured?: boolean;
  } = {},
): InternalNode => {
  const { x = 0, y = 0, width = 100, height = 50, selected = false, measured = true } = overrides;
  const node: Node = { id: "n", position: { x, y }, data: {}, selected };
  return {
    ...node,
    measured: measured ? { width, height } : {},
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userNode: node,
    },
  } as InternalNode;
};

// A 800x600 container at zoom 1 centered on the origin-anchored viewport:
// culling rect spans [-400, 1200] x [-300, 900] (bucketed dims + 0.5 overscan).
const makeSource = (initial: { width?: number; height?: number; transform?: Transform } = {}) => {
  const [state, setState] = createStore({
    onlyRenderVisibleElements: true,
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
      get onlyRenderVisibleElements() {
        return state.onlyRenderVisibleElements;
      },
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
  it("is null while culling is off, and reads no geometry", () => {
    const { setTransform, setState, source } = makeSource();
    createRoot((dispose) => {
      setState((draft) => {
        draft.onlyRenderVisibleElements = false;
      });
      const cullingViewport = createCullingViewport(source);
      let runs = 0;
      const rect = createMemo(() => {
        runs++;
        return cullingViewport();
      });
      flush();
      expect(rect()).toBeNull();
      expect(runs).toBe(1);

      // Geometry changes must not recompute the disabled memo's consumers.
      setTransform([-100, -50, 1]);
      flush();
      expect(rect()).toBeNull();
      expect(runs).toBe(1);
      dispose();
    });
  });

  it("is null while the container is unmeasured", () => {
    const { source } = makeSource({ width: 0, height: 0 });
    createRoot((dispose) => {
      const cullingViewport = createCullingViewport(source);
      flush();
      expect(cullingViewport()).toBeNull();
      dispose();
    });
  });

  it("always covers the actual visible rect (property sweep)", () => {
    const { setTransform, setState, source } = makeSource();
    createRoot((dispose) => {
      const cullingViewport = createCullingViewport(source);
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
  });

  it("holds its value (and downstream memos) while panning inside the quantization step", () => {
    const { setTransform, source } = makeSource();
    createRoot((dispose) => {
      const cullingViewport = createCullingViewport(source);
      let runs = 0;
      const dependent = createMemo(() => {
        runs++;
        return cullingViewport();
      });
      flush();
      const initial = dependent();
      expect(initial).not.toBeNull();
      expect(runs).toBe(1);

      // Step is 0.25 * 800 = 200 flow units; a 30px pan stays inside it.
      setTransform([-30, -10, 1]);
      flush();
      expect(dependent()).toBe(initial);
      expect(runs).toBe(1);

      // A pan past the step crosses a quantization boundary.
      setTransform([-450, 0, 1]);
      flush();
      expect(dependent()).not.toBe(initial);
      expect(runs).toBe(2);
      dispose();
    });
  });
});

describe("isNodeCulled", () => {
  const rect: Rect = { x: -400, y: -300, width: 1600, height: 1200 };

  it("keeps nodes intersecting the culling rect", () => {
    expect(isNodeCulled(makeInternalNode({ x: 0, y: 0 }), rect)).toBe(false);
    // Straddling the boundary still intersects.
    expect(isNodeCulled(makeInternalNode({ x: -450, y: 0 }), rect)).toBe(false);
  });

  it("culls nodes fully outside the rect", () => {
    expect(isNodeCulled(makeInternalNode({ x: 2000, y: 0 }), rect)).toBe(true);
    expect(isNodeCulled(makeInternalNode({ x: 0, y: -1000 }), rect)).toBe(true);
  });

  it("never culls selected nodes", () => {
    expect(isNodeCulled(makeInternalNode({ x: 2000, selected: true }), rect)).toBe(false);
  });

  it("never culls unmeasured nodes (measurement pipeline must not starve)", () => {
    expect(isNodeCulled(makeInternalNode({ x: 2000, measured: false }), rect)).toBe(false);
  });

  it("culls nothing while the culling viewport is null (feature off)", () => {
    expect(isNodeCulled(makeInternalNode({ x: 2000 }), null)).toBe(false);
  });
});

describe("isEdgeCulled", () => {
  const rect: Rect = { x: -400, y: -300, width: 1600, height: 1200 };
  const edge = (sx: number, sy: number, tx: number, ty: number, selected = false) => ({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    selected,
  });

  it("keeps edges whose segment box intersects the rect", () => {
    expect(isEdgeCulled(edge(0, 0, 100, 100), rect)).toBe(false);
    // Both endpoints outside, segment box crossing the rect (long edge).
    expect(isEdgeCulled(edge(-1000, 0, 3000, 0), rect)).toBe(false);
  });

  it("culls edges fully outside the rect (degenerate boxes included)", () => {
    expect(isEdgeCulled(edge(2000, 0, 3000, 0), rect)).toBe(true);
    // Zero-height horizontal segment below the rect.
    expect(isEdgeCulled(edge(0, 2000, 500, 2000), rect)).toBe(true);
  });

  it("never culls selected edges", () => {
    expect(isEdgeCulled(edge(2000, 0, 3000, 0, true), rect)).toBe(false);
  });

  it("culls nothing while the culling viewport is null", () => {
    expect(isEdgeCulled(edge(2000, 0, 3000, 0), null)).toBe(false);
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
