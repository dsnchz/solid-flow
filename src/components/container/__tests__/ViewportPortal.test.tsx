import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import type { Node } from "@/types";

import { ViewportPortal } from "../ViewportPortal";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const nodes: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

// ViewportPortal renders into the viewport (Svelte Flow's contract): its
// content pans and zooms with the graph, in front of the nodes by default or
// behind the edges with target="back".
describe("ViewportPortal", () => {
  it("renders into the viewport, in front of the nodes by default", async () => {
    const { container } = render(() => (
      <SolidFlow nodes={nodes} width={800} height={600}>
        <ViewportPortal>
          <div data-testid="front-content" />
        </ViewportPortal>
      </SolidFlow>
    ));
    await tick();

    const content = container.querySelector('[data-testid="front-content"]');
    expect(content).not.toBeNull();
    expect(content!.closest(".solid-flow__viewport")).not.toBeNull();
    const front = content!.closest(".solid-flow__viewport-front")!;
    expect(front).not.toBeNull();
    // after the node layer in document order: drawn on top of the nodes
    const nodesLayer = container.querySelector(".solid-flow__nodes")!;
    expect(
      nodesLayer.compareDocumentPosition(front) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('target="back" renders behind the edges, and passes attributes to its wrapper', async () => {
    const { container } = render(() => (
      <SolidFlow nodes={nodes} width={800} height={600}>
        <ViewportPortal target="back" class="grid-overlay" style={{ opacity: 0.5 }}>
          <div data-testid="back-content" />
        </ViewportPortal>
      </SolidFlow>
    ));
    await tick();

    const content = container.querySelector('[data-testid="back-content"]')!;
    const back = content.closest(".solid-flow__viewport-back")!;
    expect(back).not.toBeNull();
    const edgesLayer = container.querySelector(".solid-flow__edges")!;
    expect(
      back.compareDocumentPosition(edgesLayer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const wrapper = content.parentElement!;
    expect(wrapper.classList.contains("grid-overlay")).toBe(true);
    expect(wrapper.style.opacity).toBe("0.5");
  });
});
