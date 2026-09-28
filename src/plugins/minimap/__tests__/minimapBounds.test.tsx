import { captureArtifact } from "@solidjs/diagnostics";
import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";
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

describe("minimap bounding rect", () => {
  it("a viewport move inside the graph's bounds leaves the bounding rect (and its readers) alone", async () => {
    // The bounding rect is the union of the graph bounds and the visible
    // viewport. While the viewport stays inside the graph, every pan or zoom
    // recomputes the same union: without an equality cut each run was a
    // fresh object and every reader (scale, viewBox, mask) re-ran for
    // nothing — the dev runtime's UNSTABLE_MEMO_OUTPUT, seen on the SSR page.
    const nodes: Node[] = [
      { id: "a", position: { x: -2000, y: -2000 }, data: { label: "a" }, width: 100, height: 40 },
      { id: "b", position: { x: 4000, y: 4000 }, data: { label: "b" }, width: 100, height: 40 },
    ];
    let ctx!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      ctx = useInternalSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow defaultNodes={nodes} defaultEdges={[]} width={800} height={600}>
        <MiniMap />
        <Probe />
      </SolidFlow>
    ));
    await tick();
    await tick();
    const viewBox = () =>
      container.querySelector(".solid-flow__minimap-svg")?.getAttribute("viewBox");
    const before = viewBox();

    const { artifact } = await captureArtifact(
      () => {
        for (let i = 1; i <= 8; i++) {
          ctx.actions.setViewport({ x: -i * 10, y: -i * 5, zoom: 1 });
          flush();
        }
      },
      {
        scenario: "pan inside the graph",
        attribution: {
          log: false,
          hotTime: { budgetMs: Number.POSITIVE_INFINITY, windowMs: 1000 },
        },
      },
    );
    expect(artifact.diagnostics.map((d) => `${d.code}:${d.nodeName ?? ""}`)).not.toContain(
      "UNSTABLE_MEMO_OUTPUT:boundingRect",
    );
    expect(viewBox()).toBe(before);
  });
});
