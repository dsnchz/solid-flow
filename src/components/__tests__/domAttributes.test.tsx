import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

/**
 * `domAttributes` reach the wrapper element and follow updates. They are
 * applied with a direct `spread` from the ref instead of a JSX spread: the
 * compiler emits `merge({...bindings}, () => row.domAttributes)` for a JSX
 * spread, and that function source becomes a memo every binding read pulls —
 * which marks the whole dirty heap during a large mount (~3s of a 12s 10k
 * mount, profile round 17).
 */
describe("domAttributes", () => {
  const renderProbed = () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const nodes: Node[] = [
      {
        id: "a",
        position: { x: 0, y: 0 },
        data: {},
        width: 100,
        height: 40,
        domAttributes: { title: "node a", "data-kind": "alpha" } as Node["domAttributes"],
      },
      { id: "b", position: { x: 200, y: 0 }, data: {}, width: 100, height: 40 },
    ];
    const edges: Edge[] = [
      {
        id: "e1",
        source: "a",
        target: "b",
        domAttributes: { "data-kind": "link" } as Edge["domAttributes"],
      },
    ];
    const rendered = render(() => (
      <SolidFlow defaultNodes={nodes} defaultEdges={edges} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    const nodeEl = () =>
      rendered.container.querySelector<HTMLElement>('.solid-flow__node[data-id="a"]')!;
    const edgeEl = () =>
      rendered.container.querySelector<HTMLElement>('.solid-flow__edge[data-id="e1"]')!;
    return { api: () => api, nodeEl, edgeEl };
  };

  it("lands on the node wrapper and follows updateNode", () => {
    const { api, nodeEl } = renderProbed();
    flush();
    expect(nodeEl().getAttribute("title")).toBe("node a");
    expect(nodeEl().getAttribute("data-kind")).toBe("alpha");
    // Flow-owned attributes are untouched by the spread.
    expect(nodeEl().getAttribute("data-id")).toBe("a");
    expect(nodeEl().classList.contains("solid-flow__node")).toBe(true);

    api().commands.updateNode("a", {
      domAttributes: { title: "renamed", "data-kind": "beta" } as Node["domAttributes"],
    });
    flush();
    expect(nodeEl().getAttribute("title")).toBe("renamed");
    expect(nodeEl().getAttribute("data-kind")).toBe("beta");
  });

  it("lands on the edge wrapper and follows updateEdge", async () => {
    const { api, edgeEl } = renderProbed();
    flush();
    await new Promise((r) => setTimeout(r, 20));
    expect(edgeEl().getAttribute("data-kind")).toBe("link");
    api().commands.updateEdge("e1", {
      domAttributes: { "data-kind": "wire" } as Edge["domAttributes"],
    });
    flush();
    expect(edgeEl().getAttribute("data-kind")).toBe("wire");
  });
});
