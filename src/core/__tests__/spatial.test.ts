// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SpatialGrid } from "../spatial";

const rect = (x: number, y: number, width = 10, height = 10) => ({ x, y, width, height });

describe("SpatialGrid", () => {
  it("returns exactly the entries overlapping a query rect (brute-force equivalence)", () => {
    const grid = new SpatialGrid(100);
    const rects = new Map<string, { x: number; y: number; width: number; height: number }>();
    // Deterministic pseudo-random layout, including rects larger than a cell.
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 500; i++) {
      const r = rect(
        rand() * 5000 - 1000,
        rand() * 5000 - 1000,
        10 + rand() * 400,
        10 + rand() * 300,
      );
      rects.set(`n${i}`, r);
      grid.insert(`n${i}`, r);
    }

    const overlaps = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
      a.x <= b.x + b.width &&
      a.x + a.width >= b.x &&
      a.y <= b.y + b.height &&
      a.y + a.height >= b.y;

    for (let q = 0; q < 50; q++) {
      const query = rect(
        rand() * 5000 - 1500,
        rand() * 5000 - 1500,
        50 + rand() * 800,
        50 + rand() * 800,
      );
      const expected = [...rects.entries()]
        .filter(([, r]) => overlaps(query, r))
        .map(([id]) => id)
        .sort();
      const got = grid.queryRect(query).sort();
      expect(got).toEqual(expected);
    }
  });

  it("handles negative coordinates and zero-size rects", () => {
    const grid = new SpatialGrid(50);
    grid.insert("a", rect(-500, -500, 0, 0));
    grid.insert("b", rect(500, 500));
    expect(grid.queryRect(rect(-510, -510, 20, 20))).toEqual(["a"]);
    expect(grid.queryRect(rect(0, 0, 10, 10))).toEqual([]);
  });

  it("returns each entry once even when it spans many cells", () => {
    const grid = new SpatialGrid(10);
    grid.insert("wide", rect(0, 0, 1000, 5));
    expect(grid.queryRect(rect(400, 0, 300, 10))).toEqual(["wide"]);
  });
});
