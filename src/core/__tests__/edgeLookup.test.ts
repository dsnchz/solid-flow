// @vitest-environment node
import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge } from "@/types";

import { createEdgeLookup } from "../projections/edgeLookup";

// The edge lookup must hand out the edge store's OWN row proxies: a re-wrapped
// copy would attach every nested leaf a consumer reads (`edgeLookup[id].data`,
// markers, style) to the lookup's long-lived projection family, keeping
// deleted edges reachable for the flow's lifetime (bench round 20).
const setup = (initial: Edge[]) =>
  createRoot(() => {
    const [edges, setEdges] = createStore<Edge[]>(initial);
    const edgeLookup = createEdgeLookup({
      get edges() {
        return edges;
      },
    });
    flush();
    return { edges, setEdges, edgeLookup };
  });

describe("createEdgeLookup", () => {
  it("serves the edge store's own row proxy by id", () => {
    const { edges, edgeLookup } = setup([
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ]);
    expect(edgeLookup.e1).toBe(edges[0]);
    expect(edgeLookup.e2).toBe(edges[1]);
  });

  it("stays keyed by id across reorders and removals", () => {
    const { edges, setEdges, edgeLookup } = setup([
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ]);
    setEdges((draft) => {
      draft.reverse();
    });
    flush();
    expect(edgeLookup.e1).toBe(edges[1]);
    expect(Object.keys(edgeLookup).sort()).toEqual(["e1", "e2"]);

    setEdges((draft) => {
      draft.splice(1, 1);
    });
    flush();
    expect(edgeLookup.e1).toBeUndefined();
    expect("e1" in edgeLookup).toBe(false);
    expect(Object.keys(edgeLookup)).toEqual(["e2"]);
  });
});
