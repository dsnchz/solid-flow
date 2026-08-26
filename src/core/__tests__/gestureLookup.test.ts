// @vitest-environment node
import { nodeToRect } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import type { InternalNode } from "@/types";

import { GestureSpatialLookup } from "../gestureLookup";

const internalNode = (id: string, x: number, y: number, w = 100, h = 40): InternalNode =>
  ({
    id,
    position: { x, y },
    data: {},
    measured: { width: w, height: h },
    internals: { positionAbsolute: { x, y }, z: 0, userNode: { id } },
  }) as unknown as InternalNode;

const makeReal = (nodes: InternalNode[]) => new Map(nodes.map((n) => [n.id, n]));

describe("GestureSpatialLookup", () => {
  const nodes = Array.from({ length: 200 }, (_, i) =>
    internalNode(`n${i}`, (i % 20) * 150, Math.floor(i / 20) * 120),
  );
  const real = makeReal(nodes);

  it("unarmed: behaves exactly like the real lookup", () => {
    const lookup = new GestureSpatialLookup(real, 250);
    expect([...lookup.values()].length).toBe(200);
    expect(lookup.get("n5")).toBe(real.get("n5"));
    expect(lookup.has("n5")).toBe(true);
    expect(lookup.size).toBe(200);
  });

  it("armed: values() yields exactly the nodes overlapping the query rect (upstream scan equivalence)", () => {
    const lookup = new GestureSpatialLookup(real, 250);
    lookup.arm((node) => nodeToRect(node));
    const radius = 270;

    for (const center of [
      { x: 0, y: 0 },
      { x: 1500, y: 600 },
      { x: 2900, y: 1100 },
      { x: -400, y: -400 },
    ]) {
      lookup.setQueryCenter(center, radius);
      const rect = {
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2,
      };
      // Mirror of upstream getNodesWithinDistance's overlap filter.
      const expected = nodes
        .filter((n) => {
          const r = nodeToRect(n);
          return (
            r.x <= rect.x + rect.width &&
            r.x + r.width >= rect.x &&
            r.y <= rect.y + rect.height &&
            r.y + r.height >= rect.y
          );
        })
        .map((n) => n.id)
        .sort();
      const got = [...lookup.values()].map((n) => n.id).sort();
      expect(got).toEqual(expected);
    }
  });

  it("armed: get/has still resolve ANY node (validation paths)", () => {
    const lookup = new GestureSpatialLookup(real, 250);
    lookup.arm((node) => nodeToRect(node));
    lookup.setQueryCenter({ x: 0, y: 0 }, 100);
    expect(lookup.get("n199")).toBe(real.get("n199"));
    expect(lookup.has("n199")).toBe(true);
  });

  it("setQueryRect: exact rect-overlap equivalence (box selection)", () => {
    const lookup = new GestureSpatialLookup(real, 400);
    lookup.arm((node) => nodeToRect(node));
    const rect = { x: 300, y: 150, width: 900, height: 500 };
    lookup.setQueryRect(rect);
    const expected = nodes
      .filter((n) => {
        const r = nodeToRect(n);
        return (
          r.x <= rect.x + rect.width &&
          r.x + r.width >= rect.x &&
          r.y <= rect.y + rect.height &&
          r.y + r.height >= rect.y
        );
      })
      .map((n) => n.id)
      .sort();
    expect([...lookup.values()].map((n) => n.id).sort()).toEqual(expected);
  });

  it("disarm() restores full iteration", () => {
    const lookup = new GestureSpatialLookup(real, 250);
    lookup.arm((node) => nodeToRect(node));
    lookup.setQueryCenter({ x: 0, y: 0 }, 50);
    expect([...lookup.values()].length).toBeLessThan(200);
    lookup.disarm();
    expect([...lookup.values()].length).toBe(200);
  });
});
