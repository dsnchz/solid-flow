// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SubsetMapView } from "../subsetMapView";

// XYDrag's start scans the WHOLE nodeLookup to pick the selected nodes and
// the dragged node (bench round 22: ~19ms first drag frame @10k through the
// record facade). A gesture-scoped view iterates only the candidate ids but
// still resolves any key (parents, deleted-while-dragging checks).
describe("SubsetMapView", () => {
  const full = new Map<string, { id: string; selected?: boolean }>([
    ["a", { id: "a", selected: true }],
    ["b", { id: "b" }],
    ["c", { id: "c", selected: true }],
    ["p", { id: "p" }],
  ]);

  it("iterates only the candidate ids, in candidate order, skipping missing ones", () => {
    const view = new SubsetMapView(full, () => ["c", "zzz", "a"]);
    expect([...view.keys()]).toEqual(["c", "a"]);
    expect([...view].map(([id, node]) => `${id}:${node.id}`)).toEqual(["c:c", "a:a"]);
    expect([...view.values()].map((n) => n.id)).toEqual(["c", "a"]);
    const seen: string[] = [];
    view.forEach((node, key) => seen.push(`${key}=${node.id}`));
    expect(seen).toEqual(["c=c", "a=a"]);
    expect(view.size).toBe(2);
  });

  it("resolves ANY key through the full map", () => {
    const view = new SubsetMapView(full, () => ["a"]);
    expect(view.get("p")).toBe(full.get("p"));
    expect(view.has("b")).toBe(true);
    expect(view.get("nope")).toBeUndefined();
    expect(view.has("nope")).toBe(false);
  });

  it("re-reads the candidates on every iteration", () => {
    let ids = ["a"];
    const view = new SubsetMapView(full, () => ids);
    expect([...view.keys()]).toEqual(["a"]);
    ids = ["b", "c"];
    expect([...view.keys()]).toEqual(["b", "c"]);
  });
});
