import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { MiniMap } from "@/plugins/minimap/MiniMap";
import type { Node } from "@/types";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("minimap bounds guard (WP2 / B1)", () => {
  it("keeps the viewBox finite while nodes are unmeasured", async () => {
    // Nodes WITHOUT width/height stay unmeasured under the jsdom stubs —
    // getInternalNodesBounds yields an Infinity rect for them, which once
    // poisoned viewScale (NaN) and, through XYMinimap, the shared viewport.
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "a" } },
      { id: "b", position: { x: 200, y: 0 }, data: { label: "b" } },
    ];
    const { container } = render(() => (
      <SolidFlow nodes={nodes} edges={[]} width={800} height={600}>
        <MiniMap />
      </SolidFlow>
    ));
    await tick();

    const viewBox = container.querySelector(".solid-flow__minimap-svg")?.getAttribute("viewBox");
    expect(viewBox).toBeTruthy();
    expect(viewBox).not.toContain("NaN");
    expect(viewBox).not.toContain("Infinity");
  });
});
