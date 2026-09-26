import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

/**
 * Standalone `<SolidFlow>` mounts its row ELEMENTS in the settle flush (the
 * renderers' lists are gated on onSettled): the engine builds the same
 * 10k-row tree ~20-30% cheaper there than inside the initial render(), and
 * the culling viewport and pan-zoom exist before the first row does (mount
 * profile round 30: 3.6 s -> 2.8 s at 10k — the bench is the measure; in
 * jsdom the settle continuation runs inside render(), so the two contracts
 * below are what a unit test can pin). The STORE is still seeded
 * synchronously: children read the graph during their own setup. The server
 * renders rows immediately (SSR lane).
 */
describe("row elements mount after settle", () => {
  const nodes: Node[] = [
    { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
    { id: "b", position: { x: 200, y: 0 }, data: {}, width: 100, height: 40 },
  ];
  const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

  it("children read the seeded graph during their own setup, before any row element exists", () => {
    let setupIds: string[] = [];
    let setupEdgeIds: string[] = [];
    const Probe = () => {
      const api = useSolidFlow();
      setupIds = api.flow.nodes.map((n) => n.id);
      setupEdgeIds = api.flow.edges.map((e) => e.id);
      return null;
    };
    render(() => (
      <SolidFlow nodes={nodes} edges={edges} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    expect(setupIds).toEqual(["a", "b"]);
    expect(setupEdgeIds).toEqual(["e1"]);
  });

  it("every node element is in the DOM once the mount returns; edges follow the measurement pass", async () => {
    const { container } = render(() => (
      <SolidFlow nodes={nodes} edges={edges} width={800} height={600} />
    ));
    flush();
    expect(container.querySelectorAll(".solid-flow__node")).toHaveLength(2);
    // Edge rows need measured endpoints (jsdom's ResizeObserver stub delivers
    // a microtask later, like the real one).
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelectorAll(".solid-flow__edge")).toHaveLength(1);
  });

  it("uncontrolled defaults render the same way", () => {
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }]}
        defaultEdges={[]}
        width={800}
        height={600}
      />
    ));
    flush();
    expect(container.querySelectorAll(".solid-flow__node")).toHaveLength(1);
  });
});
