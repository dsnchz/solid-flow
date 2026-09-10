// @vitest-environment node
import { createRoot, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "@/types";

import { createFlowState } from "../createFlowState";

const makeNode = (id: string, x = 0): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

/**
 * The merge path of updateNode/updateEdge writes fields INTO the draft row
 * instead of replacing the array slot. A slot replacement looks like a
 * membership change to everything keyed on row identity (the id lists, the
 * lookups, the per-row mapArray rows) — one `updateNodeData` re-derived the
 * whole graph (~78ms per edge write @10k, bench round 17). `replace: true`
 * keeps its wholesale semantics.
 */
describe("updateNode / updateEdge write in place", () => {
  const setup = () => {
    let state!: ReturnType<typeof createFlowState>;
    let dispose!: () => void;
    createRoot((d) => {
      dispose = d;
      state = createFlowState({
        nodes: [makeNode("a"), makeNode("b", 200)],
        edges: [{ id: "e1", source: "a", target: "b" } as Edge],
      });
    });
    flush();
    return { state, dispose };
  };

  it("updateNode (merge) keeps the row slot and the membership id list identity", () => {
    const { state, dispose } = setup();
    const rowBefore = state.store.nodes[0];
    const idsBefore = state.store.visibleNodeIds;
    const internalBefore = state.internalNodes.a;

    state.commands.updateNode("a", { data: { label: "renamed" }, position: { x: 5, y: 5 } });
    flush();

    expect(state.store.nodes[0]).toBe(rowBefore);
    expect(state.store.visibleNodeIds).toBe(idsBefore);
    expect(state.internalNodes.a).toBe(internalBefore);
    expect(state.store.nodes[0]!.data).toEqual({ label: "renamed" });
    expect(state.internalNodes.a!.internals.positionAbsolute).toEqual({ x: 5, y: 5 });
    dispose();
  });

  it("updateNodeData is a field write too", () => {
    const { state, dispose } = setup();
    const idsBefore = state.store.visibleNodeIds;
    state.commands.updateNodeData("b", { extra: 1 });
    flush();
    expect(state.store.visibleNodeIds).toBe(idsBefore);
    expect(state.store.nodes[1]!.data).toEqual({ label: "b", extra: 1 });
    dispose();
  });

  it("merge sets undefined-valued keys like a spread would", () => {
    const { state, dispose } = setup();
    state.commands.updateNode("a", { selected: true });
    flush();
    expect(state.internalNodes.a!.selected).toBe(true);
    state.commands.updateNode("a", { width: undefined });
    flush();
    expect("width" in state.store.nodes[0]!).toBe(true);
    expect(state.store.nodes[0]!.width).toBeUndefined();
    dispose();
  });

  it("replace: true still drops keys not in the replacement", () => {
    const { state, dispose } = setup();
    state.commands.updateNode("a", { selected: true });
    flush();
    state.commands.updateNode("a", makeNode("a", 9), { replace: true });
    flush();
    expect(state.store.nodes[0]!.selected).toBeUndefined();
    expect(state.store.nodes[0]!.position).toEqual({ x: 9, y: 0 });
    dispose();
  });

  it("updateEdge (merge) keeps the edge slot, the edge lookup entry and the id list identity", () => {
    const { state, dispose } = setup();
    const rowBefore = state.store.edges[0];
    const lookupBefore = state.edgeLookup.e1;
    const idsBefore = state.store.visibleEdgeIds;

    state.commands.updateEdge("e1", { targetHandle: "in", animated: true });
    flush();

    expect(state.store.edges[0]).toBe(rowBefore);
    expect(state.edgeLookup.e1).toBe(lookupBefore);
    expect(state.store.visibleEdgeIds).toBe(idsBefore);
    expect(state.store.edges[0]!.targetHandle).toBe("in");
    expect(state.store.edges[0]!.animated).toBe(true);
    dispose();
  });
});
