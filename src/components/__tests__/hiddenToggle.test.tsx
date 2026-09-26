import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number, hidden?: boolean): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
  ...(hidden !== undefined ? { hidden } : {}),
});

// Found live in the playground (Overview hide/unhide button): a node that
// starts hidden can be unhidden, but a visible node written hidden never
// leaves the DOM again.
describe("hidden toggle round-trip", () => {
  it("hide → unhide → hide removes and restores the node's DOM element", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("h", 200, true)]}
        defaultEdges={[]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();

    const query = (id: string) => container.querySelector(`.solid-flow__node[data-id="${id}"]`);

    // Initially: "a" mounted, "h" hidden (not in the DOM).
    expect(query("a")).not.toBeNull();
    expect(query("h")).toBeNull();

    // Unhide "h".
    api.updateNode("h", (node) => ({ hidden: !node.hidden }));
    await tick();
    expect(query("h")).not.toBeNull();

    // Re-hide "h" — the round trip must remove it again.
    api.updateNode("h", (node) => ({ hidden: !node.hidden }));
    await tick();
    expect(query("h")).toBeNull();

    // A never-hidden node must also be hideable.
    api.updateNode("a", (node) => ({ hidden: !node.hidden }));
    await tick();
    expect(query("a")).toBeNull();
  });

  it("hide → unhide → hide removes and restores the edge's DOM element", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 200)]}
        defaultEdges={[
          { id: "e1", source: "a", target: "b" },
          { id: "eh", source: "b", target: "a", hidden: true },
        ]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();

    const query = (id: string) => container.querySelector(`.solid-flow__edge[data-id="${id}"]`);

    expect(query("e1")).not.toBeNull();
    expect(query("eh")).toBeNull();

    api.updateEdge("eh", (edge) => ({ hidden: !edge.hidden }));
    await tick();
    expect(query("eh")).not.toBeNull();

    api.updateEdge("eh", (edge) => ({ hidden: !edge.hidden }));
    await tick();
    expect(query("eh")).toBeNull();

    api.updateEdge("e1", (edge) => ({ hidden: !edge.hidden }));
    await tick();
    expect(query("e1")).toBeNull();
  });
});

// Upstream parity (xyflow#5977, Svelte Flow 1.6.6): hiding a node hides the
// edges attached to it. Here it follows from the measurement contract: a
// hidden node's handle bounds are cleared, so its edge rows produce no
// geometry and leave the DOM; unhiding re-measures and restores them.
describe("hidden node hides its edges", () => {
  it("hide → unhide on a node removes and restores its edges' DOM elements", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 200), makeNode("c", 400)]}
        defaultEdges={[
          { id: "ab", source: "a", target: "b" },
          { id: "bc", source: "b", target: "c" },
        ]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();
    const edge = (id: string) => container.querySelector(`.solid-flow__edge[data-id="${id}"]`);
    expect(edge("ab")).not.toBeNull();
    expect(edge("bc")).not.toBeNull();

    api.updateNode("b", { hidden: true });
    await tick();
    expect(edge("ab")).toBeNull();
    expect(edge("bc")).toBeNull();

    api.updateNode("b", { hidden: false });
    await tick();
    expect(edge("ab")).not.toBeNull();
    expect(edge("bc")).not.toBeNull();
  });
});
