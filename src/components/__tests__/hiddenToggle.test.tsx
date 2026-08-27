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
});
