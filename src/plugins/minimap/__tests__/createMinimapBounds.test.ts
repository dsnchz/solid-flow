import type { Rect, Viewport } from "@xyflow/system";
import { createRoot, createSignal, flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NodeGeometry } from "@/core/projections/internalNodes";

import { createMinimapBounds, type MinimapBoundsSource } from "../minimapBounds";

// What the minimap must show: the graph's bounds (sampled from the plain
// geometry map, never tracked row by row) joined with the visible viewport.

// `-viewport.x / zoom` is -0 at the origin; compare values, not signed zeros.
const plain = (rect: Rect): Rect => ({
  x: rect.x + 0,
  y: rect.y + 0,
  width: rect.width,
  height: rect.height,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () => {
  const geometry = new Map<string, NodeGeometry>([["a", { x: 0, y: 0, width: 100, height: 50 }]]);
  const [changes, setChanges] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);
  const [viewport, setViewport] = createSignal<Viewport>({ x: 0, y: 0, zoom: 1 });
  const dragOverlay: Record<string, unknown> = {};
  const source: MinimapBoundsSource = {
    geometry,
    geometryChanges: changes,
    dragOverlay,
    store: {
      get dragging() {
        return dragging();
      },
      nodes: [{}],
      nodesInitialized: true,
      get viewport() {
        return viewport();
      },
      width: 10,
      height: 10,
    },
  };
  let dispose!: () => void;
  let bounds!: ReturnType<typeof createMinimapBounds>;
  createRoot((d) => {
    dispose = d;
    bounds = createMinimapBounds(source);
  });
  flush();
  const move = (id: string, rect: NodeGeometry) => {
    geometry.set(id, rect);
    setChanges((n) => n + 1);
    flush();
  };
  return { bounds, move, setDragging, setViewport, dragOverlay, dispose };
};

describe("createMinimapBounds", () => {
  it("joins the graph's bounds with the visible viewport", () => {
    const { bounds, setViewport, dispose } = setup();
    expect(plain(bounds.boundingRect())).toEqual({ x: 0, y: 0, width: 100, height: 50 });

    setViewport({ x: 50, y: 0, zoom: 1 });
    flush();
    expect(plain(bounds.viewBB())).toEqual({ x: -50, y: 0, width: 10, height: 10 });
    expect(plain(bounds.boundingRect())).toEqual({ x: -50, y: 0, width: 150, height: 50 });
    dispose();
  });

  it("follows a geometry change outside a drag within one resample window", () => {
    const { bounds, move, dispose } = setup();
    move("b", { x: 300, y: 0, width: 100, height: 50 });
    move("c", { x: 0, y: 200, width: 100, height: 50 });
    expect(bounds.boundingRect().width).toBe(100);

    vi.advanceTimersByTime(250);
    flush();
    expect(plain(bounds.boundingRect())).toEqual({ x: 0, y: 0, width: 400, height: 250 });
    // the window is spent: nothing stays armed
    expect(vi.getTimerCount()).toBe(0);
    dispose();
  });

  it("samples the dragged rows every animation frame while dragging", () => {
    const { bounds, move, setDragging, dragOverlay, dispose } = setup();
    dragOverlay.a = {};
    setDragging(true);
    flush();
    move("a", { x: -500, y: 0, width: 100, height: 50 });
    vi.advanceTimersByTime(20);
    flush();
    expect(bounds.boundingRect().x).toBe(-500);

    setDragging(false);
    flush();
    expect(vi.getTimerCount()).toBe(0);
    dispose();
  });
});
