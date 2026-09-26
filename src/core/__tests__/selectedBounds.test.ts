// @vitest-environment node
import { getInternalNodesBounds, type Rect } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import type { InternalNode, Node } from "@/types";

import { getSelectedNodesBounds, type NodeRect } from "../projections/selectedBounds";

const internal = (id: string, x: number, y: number, w = 100, h = 40, selected = false) =>
  ({
    id,
    position: { x, y },
    data: {},
    selected,
    measured: { width: w, height: h },
    internals: { positionAbsolute: { x, y }, z: 0, userNode: { id } as Node },
  }) as unknown as InternalNode;

/** The rect the row derive reports for a node: absolute position + dimensions. */
const rectOf = (node: InternalNode): NodeRect => ({
  x: node.internals.positionAbsolute.x,
  y: node.internals.positionAbsolute.y,
  width: node.measured.width ?? 0,
  height: node.measured.height ?? 0,
});

/**
 * A geometry map that refuses to be enumerated: the bounds derivation must
 * resolve ONLY the selected ids through `get`, never walk the map (the
 * original tracked full scan subscribed every node's `selected` leaf — a
 * 20k-dependency memo torn down and rebuilt on every selection-drag frame
 * @10k; the later proxy-lookup form read ~40 ms of rows on a select-all).
 */
class KeyedOnlyGeometry extends Map<string, NodeRect> {
  gets = 0;
  override get(key: string) {
    this.gets++;
    return super.get(key);
  }
  override forEach(): never {
    throw new Error("enumerated via forEach");
  }
  override keys(): never {
    throw new Error("enumerated via keys");
  }
  override values(): never {
    throw new Error("enumerated via values");
  }
  override entries(): never {
    throw new Error("enumerated via entries");
  }
  override [Symbol.iterator](): never {
    throw new Error("enumerated via iteration");
  }
}

const geometryOf = (nodes: InternalNode[]) =>
  new KeyedOnlyGeometry(nodes.map((n) => [n.id, rectOf(n)]));
const selectedIds = (nodes: InternalNode[]) =>
  Object.fromEntries(nodes.filter((n) => n.selected).map((n) => [n.id, { id: n.id }]));

describe("getSelectedNodesBounds", () => {
  it("reads only the selected rows: O(selected) gets, no enumeration", () => {
    const nodes = Array.from({ length: 1000 }, (_, i) =>
      internal(`n${i}`, (i % 40) * 150, Math.floor(i / 40) * 100, 100, 40, i === 7 || i === 519),
    );
    const geometry = geometryOf(nodes);

    const bounds = getSelectedNodesBounds(selectedIds(nodes), geometry);

    expect(geometry.gets).toBe(2);
    expect(bounds).toEqual(
      getInternalNodesBounds(new Map(nodes.map((n) => [n.id, n])), {
        filter: (n) => !!n.selected,
      }),
    );
  });

  it("matches the system helper's union semantics (mixed sizes, negative coords)", () => {
    const nodes = [
      internal("a", -50, 20, 100, 40, true),
      internal("b", 300, -10, 20, 200, true),
      internal("c", 900, 900, 100, 100, false),
      internal("d", 10, 10, 0, 0, true),
    ];
    const expected: Rect = getInternalNodesBounds(new Map(nodes.map((n) => [n.id, n])), {
      filter: (n) => !!n.selected,
    });
    expect(getSelectedNodesBounds(selectedIds(nodes), geometryOf(nodes))).toEqual(expected);
  });

  it("returns the system helper's zero rect when nothing is selected", () => {
    const nodes = [internal("a", 0, 0), internal("b", 100, 100)];
    expect(getSelectedNodesBounds({}, geometryOf(nodes))).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it("skips ids the map cannot resolve (row removed before the presence record caught up)", () => {
    const nodes = [internal("a", 10, 10, 30, 30, true)];
    expect(
      getSelectedNodesBounds({ a: { id: "a" }, gone: { id: "gone" } }, geometryOf(nodes)),
    ).toEqual({ x: 10, y: 10, width: 30, height: 30 });
  });
});
