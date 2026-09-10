// @vitest-environment node
import { getInternalNodesBounds } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import type { InternalNode, Node } from "@/types";

import { createGraphBoundsSampler } from "../graphBounds";

const internal = (
  id: string,
  x: number,
  y: number,
  opts: { w?: number; h?: number; parentId?: string } = {},
) =>
  ({
    id,
    position: { x, y },
    data: {},
    parentId: opts.parentId,
    measured: { width: opts.w ?? 100, height: opts.h ?? 40 },
    internals: { positionAbsolute: { x, y }, z: 0, userNode: { id } as Node },
  }) as unknown as InternalNode;

/** Counts keyed gets; throws on any enumeration (the per-frame path must never walk). */
class CountingLookup extends Map<string, InternalNode> {
  gets = 0;
  walks = 0;
  override get(key: string) {
    this.gets++;
    return super.get(key);
  }
  override forEach(cb: (v: InternalNode, k: string, m: Map<string, InternalNode>) => void) {
    this.walks++;
    super.forEach(cb);
  }
}

const setup = (nodes: InternalNode[]) => {
  const lookup = new CountingLookup(nodes.map((n) => [n.id, n]));
  const dragged = new Set<string>();
  const sampler = createGraphBoundsSampler<Node>({
    nodeLookup: lookup,
    draggedIds: () => dragged,
  });
  const expected = () => getInternalNodesBounds(new Map(nodes.map((n) => [n.id, n])));
  return { lookup, dragged, sampler, expected, nodes };
};

describe("createGraphBoundsSampler", () => {
  it("full sample equals the system helper; unmeasured graphs sample as null", () => {
    const { sampler, expected } = setup([internal("a", 0, 0), internal("b", 500, -20, { w: 30 })]);
    expect(sampler.sample(false)).toEqual(expected());

    const empty = createGraphBoundsSampler<Node>({
      nodeLookup: new Map(),
      draggedIds: () => new Set(),
    });
    expect(empty.sample(false)).toBeNull();
  });

  it("during a drag, frames after the first read only the moving rows (no walk)", () => {
    const list = Array.from({ length: 500 }, (_, i) => internal(`n${i}`, (i % 25) * 150, 100 * i));
    const { lookup, dragged, sampler, expected, nodes } = setup(list);
    dragged.add("n7").add("n300");

    // First dragging frame: one static pass (walk) partitions moving vs static.
    const first = sampler.sample(true);
    expect(first).toEqual(expected());
    expect(lookup.walks).toBe(1);

    // Move the dragged rows far away; next frame must follow with keyed gets only.
    const move = (id: string, x: number, y: number) => {
      const n = nodes.find((r) => r.id === id)!;
      n.internals.positionAbsolute = { x, y };
      n.position = { x, y };
    };
    move("n7", -900, -900);
    move("n300", 9000, 9000);
    lookup.gets = 0;
    lookup.walks = 0;
    expect(sampler.sample(true)).toEqual(expected());
    expect(lookup.walks).toBe(0);
    expect(lookup.gets).toBe(2);
  });

  it("children of a dragged parent move with it (descendants join the moving set)", () => {
    const { dragged, sampler, expected, nodes, lookup } = setup([
      internal("p", 0, 0, { w: 400, h: 300 }),
      internal("c1", 20, 20, { parentId: "p" }),
      internal("g", 30, 30, { parentId: "c1" }),
      internal("other", 2000, 2000),
    ]);
    dragged.add("p");
    expect(sampler.sample(true)).toEqual(expected());

    // Simulate the graph's per-frame result: parent and all descendants shift.
    for (const id of ["p", "c1", "g"]) {
      const n = nodes.find((r) => r.id === id)!;
      n.internals.positionAbsolute = {
        x: n.internals.positionAbsolute.x - 5000,
        y: n.internals.positionAbsolute.y,
      };
    }
    lookup.walks = 0;
    const bounds = sampler.sample(true)!;
    expect(bounds).toEqual(expected());
    expect(bounds.x).toBe(-5000);
    expect(lookup.walks).toBe(0);
  });

  it("re-partitions when the dragged set changes, and leaves drag mode with a full sample", () => {
    const { dragged, sampler, expected, lookup } = setup([
      internal("a", 0, 0),
      internal("b", 300, 0),
      internal("c", 600, 0),
    ]);
    dragged.add("a");
    sampler.sample(true);
    expect(lookup.walks).toBe(1);

    dragged.clear();
    dragged.add("c");
    sampler.sample(true);
    expect(lookup.walks).toBe(2);
    sampler.sample(true);
    expect(lookup.walks).toBe(2);

    expect(sampler.sample(false)).toEqual(expected());
    expect(lookup.walks).toBe(3);
  });
});
