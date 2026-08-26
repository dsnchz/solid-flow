import { render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

// WP4-D6: unknown node/edge types must fall back to the "default" renderer
// (upstream parity) and report through the error channel — previously nodes
// warned but rendered Dynamic{undefined} (nothing), and edges did neither.
describe("unknown element types", () => {
  const nodes: Node[] = [
    {
      id: "a",
      type: "nope",
      data: { label: "a" },
      position: { x: 0, y: 0 },
      width: 100,
      height: 40,
    },
    { id: "b", data: { label: "b" }, position: { x: 200, y: 0 }, width: 100, height: 40 },
  ];

  it("renders unknown-type nodes with the default renderer and reports 003", async () => {
    const onFlowError = vi.fn();
    const { container } = render(() => (
      <SolidFlow defaultNodes={nodes} onFlowError={onFlowError} width={800} height={600} />
    ));
    await tick();

    const unknown = container.querySelector('[data-id="a"]');
    expect(unknown).not.toBeNull();
    // Default renderer output: the node label is rendered.
    expect(unknown!.textContent).toContain("a");
    expect(onFlowError).toHaveBeenCalledWith("003", expect.stringContaining("nope"));
  });

  it("renders unknown-type edges with the default renderer and reports 011", async () => {
    const onFlowError = vi.fn();
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={nodes}
        defaultEdges={[{ id: "e1", source: "a", target: "b", type: "bogus" }]}
        onFlowError={onFlowError}
        width={800}
        height={600}
      />
    ));
    await tick();

    const edge = container.querySelector('.solid-flow__edge[data-id="e1"]');
    expect(edge).not.toBeNull();
    expect(edge!.querySelector(".solid-flow__edge-path")).not.toBeNull();
    expect(onFlowError).toHaveBeenCalledWith("011", expect.stringContaining("bogus"));
  });
});
