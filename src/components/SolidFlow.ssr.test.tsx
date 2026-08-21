import { renderToString } from "@solidjs/web";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "~/types";

import { SolidFlow } from "./SolidFlow";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  // SSR contract (matching React Flow 12): nodes must declare their dimensions
  // to be laid out server-side, since there is no DOM to measure.
  width: 100,
  height: 40,
  ...overrides,
});

const makeEdge = (overrides: Partial<Edge> & { id: string; source: string; target: string }) =>
  ({ ...overrides }) as Edge;

describe("SolidFlow SSR", () => {
  it("renders a flow to HTML without a DOM", () => {
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })]}
        edges={[makeEdge({ id: "e1", source: "a", target: "b" })]}
        width={800}
        height={600}
      />
    ));

    expect(html).toContain("solid-flow__wrapper");
    expect(html).toContain('data-id="a"');
    expect(html).toContain('data-id="b"');
    expect(html).toContain("node-a");
    expect(html).toContain("node-b");
  });

  it("renders nodes visible when dimensions are declared", () => {
    const html = renderToString(() => (
      <SolidFlow nodes={[makeNode({ id: "a" })]} edges={[]} width={800} height={600} />
    ));

    // nodeHasDimensions is satisfied by declared width/height, so server markup
    // must not hide the node behind the pre-measurement visibility gate
    expect(html).toMatch(/data-id="a"[^>]*style="[^"]*visibility:\s*visible/);
  });

  it("computes fitView server-side from declared dimensions", () => {
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 300, y: 200 } })]}
        edges={[]}
        width={800}
        height={600}
        fitView
      />
    ));

    // the viewport transform must not be the identity if fitView ran on the server
    const transform = html.match(/solid-flow__viewport[^>]*style="[^"]*transform:\s*([^;"]+)/);
    expect(transform).not.toBeNull();
    expect(transform![1]).not.toContain("translate(0px, 0px) scale(1)");
  });

  it("renders a hidden node nowhere in the markup", () => {
    const html = renderToString(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "ghost", hidden: true })]}
        edges={[]}
        width={800}
        height={600}
      />
    ));

    expect(html).toContain('data-id="a"');
    expect(html).not.toContain('data-id="ghost"');
  });
});
