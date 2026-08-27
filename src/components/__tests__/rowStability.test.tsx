import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

// Structural-stability pins against upstream bugs: edges must not leave the
// DOM when unrelated graph writes happen.
describe("row stability", () => {
  it("edges keep their DOM element identity when a node is ADDED (xyflow#5970)", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 200)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();

    const edgeBefore = container.querySelector('.solid-flow__edge[data-id="e1"]');
    expect(edgeBefore).not.toBeNull();

    api.addNodes(makeNode("c", 400));
    await tick();

    const edgeAfter = container.querySelector('.solid-flow__edge[data-id="e1"]');
    // Upstream: edges unmount for one or more frames on a node add. Ours must
    // be the SAME element — never removed from the DOM at all.
    expect(edgeAfter).toBe(edgeBefore);
  });

  it("non-adjacent edges are untouched by a node move (xyflow#5958's failure mode)", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const edges: Edge[] = [
      { id: "near", source: "a", target: "b" },
      { id: "far", source: "c", target: "d" },
    ];
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[
          makeNode("a", 0),
          makeNode("b", 200),
          makeNode("c", 400),
          makeNode("d", 600),
        ]}
        defaultEdges={edges}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();

    const farPath = container.querySelector(
      '.solid-flow__edge[data-id="far"] .solid-flow__edge-path',
    );
    const nearPath = container.querySelector(
      '.solid-flow__edge[data-id="near"] .solid-flow__edge-path',
    );
    const farD = farPath!.getAttribute("d");
    const nearD = nearPath!.getAttribute("d");

    api.updateNode("a", { position: { x: 50, y: 60 } });
    await tick();

    // Adjacent edge re-laid-out; non-adjacent edge's geometry untouched
    // (Svelte Flow's dead layout memo re-laid EVERY edge per drag frame).
    expect(
      container
        .querySelector('.solid-flow__edge[data-id="near"] .solid-flow__edge-path')!
        .getAttribute("d"),
    ).not.toBe(nearD);
    const farPathAfter = container.querySelector(
      '.solid-flow__edge[data-id="far"] .solid-flow__edge-path',
    );
    expect(farPathAfter).toBe(farPath);
    expect(farPathAfter!.getAttribute("d")).toBe(farD);
  });
});
