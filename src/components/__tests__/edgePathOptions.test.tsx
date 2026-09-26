import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number, y: number): Node => ({
  id,
  position: { x, y },
  data: { label: id },
  width: 100,
  height: 40,
});

/**
 * Upstream parity: React Flow's EdgeWrapper passes `edge.pathOptions` to the
 * built-in edge components; every option the system path helpers take must
 * reach them here too — `curvature` (default edge), `offset` (step),
 * `borderRadius` / `offset` / `stepPosition` (smooth-step; `stepPosition`
 * is 0 = bend at the source, 1 = at the target, 0.5 = midpoint).
 */
describe("edge pathOptions", () => {
  it("reach the built-in edge types", async () => {
    const edges: Edge[] = [
      { id: "smooth-default", source: "a", target: "b", type: "smoothstep" },
      {
        id: "smooth-near-source",
        source: "a",
        target: "b",
        type: "smoothstep",
        pathOptions: { stepPosition: 0.1 },
      },
      { id: "step-default", source: "a", target: "b", type: "step" },
      {
        id: "step-near-source",
        source: "a",
        target: "b",
        type: "step",
        pathOptions: { stepPosition: 0.1 },
      },
      {
        id: "smooth-square",
        source: "a",
        target: "b",
        type: "smoothstep",
        pathOptions: { borderRadius: 0 },
      },
      { id: "step-offset", source: "a", target: "b", type: "step", pathOptions: { offset: 60 } },
      // the bezier curvature only shapes a path whose target lies behind the
      // source handle's direction: these two target the node ABOVE a
      { id: "bezier-default", source: "a", target: "c" },
      { id: "bezier-straight", source: "a", target: "c", pathOptions: { curvature: 0 } },
    ];
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0, 0), makeNode("b", 300, 200), makeNode("c", 300, -200)]}
        defaultEdges={edges}
        width={800}
        height={600}
      />
    ));
    await tick();
    const d = (id: string) =>
      container
        .querySelector<SVGPathElement>(`.solid-flow__edge[data-id="${id}"] .solid-flow__edge-path`)
        ?.getAttribute("d");
    expect(d("smooth-default")).toBeTruthy();
    expect(d("smooth-near-source")).not.toBe(d("smooth-default"));
    // every path option reaches the built-in edge types (React Flow's
    // EdgeWrapper passes `edge.pathOptions` through; ours did not)
    expect(d("smooth-square")).not.toBe(d("smooth-default"));
    expect(d("step-offset")).not.toBe(d("step-default"));
    expect(d("bezier-straight")).not.toBe(d("bezier-default"));
  });
});
