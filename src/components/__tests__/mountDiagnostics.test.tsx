import { captureArtifact } from "@solidjs/diagnostics";
import { render } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { EdgeReconnectAnchor } from "@/components/edge";
import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";
import { Background, Controls, MiniMap, NodeResizer } from "@/plugins";
import type { Edge, Node } from "@/types";

// Mounting a flow with the built-in nodes, edges and plugins emits no dev
// diagnostic (docs/ARCHITECTURE.md, "Reactive nodes are named"): anything
// the engine names is a finding. The one that motivated this:
// STRICT_READ_UNTRACKED, a reactive value read outside any tracking scope — a
// prop or flow setting that stops following changes after mount (Handle's
// `clickConnect`, found this way). The per-row WIDE_SCOPE_DEPS of the edge
// row and the node element were allowed here until each got under the line
// (endpoint versions; the class as its own effect).
const nodes: Node[] = [
  {
    id: "in",
    type: "input",
    position: { x: 0, y: 0 },
    data: { label: "in" },
    width: 150,
    height: 40,
  },
  { id: "mid", position: { x: 0, y: 100 }, data: { label: "mid" }, width: 150, height: 40 },
  {
    id: "out",
    type: "output",
    position: { x: 0, y: 200 },
    data: { label: "out" },
    width: 150,
    height: 40,
  },
];
const edges: Edge[] = [
  { id: "e1", source: "in", target: "mid" },
  { id: "e2", source: "mid", target: "out", type: "smoothstep" },
];
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

const unexpectedDiagnostics = async (mount: () => void): Promise<string[]> => {
  const { artifact } = await captureArtifact(
    async () => {
      mount();
      for (let i = 0; i < 6; i++) await tick();
    },
    // Wall-clock budgets measure the machine, not the graph (see diagnosticsBudget.test.ts).
    {
      scenario: "mount",
      attribution: {
        log: false,
        hotTime: { budgetMs: Number.POSITIVE_INFINITY, windowMs: 1000 },
      },
    },
  );
  const unexpected = artifact.diagnostics.map((d) =>
    d.code === "STRICT_READ_UNTRACKED"
      ? `${d.code}:${d.data?.strictRead ?? ""} (${d.nodeName ?? "?"})`
      : `${d.code}:${d.nodeName ?? d.ownerName ?? ""}`,
  );
  return [...new Set(unexpected)];
};

describe("mount diagnostics", () => {
  it("mounting a flow with built-in nodes, edges and plugins emits no diagnostics", async () => {
    expect(
      await unexpectedDiagnostics(() =>
        render(() => (
          <SolidFlow defaultNodes={nodes} defaultEdges={edges} width={800} height={600}>
            <Background />
            <Controls />
            <MiniMap />
          </SolidFlow>
        )),
      ),
    ).toEqual([]);
  });

  it("nodes carrying a NodeResizer emit no diagnostics", async () => {
    const ResizableNode = () => <NodeResizer />;
    const resizable = nodes.map((node) => ({ ...node, type: "resizable" }));
    expect(
      await unexpectedDiagnostics(() =>
        render(() => (
          <SolidFlow
            defaultNodes={resizable}
            defaultEdges={edges}
            nodeTypes={{ resizable: ResizableNode }}
            width={800}
            height={600}
          />
        )),
      ),
    ).toEqual([]);
  });

  it("a subflow whose children come before their parents emits no diagnostics", async () => {
    // A row with a parent is created on first use, from the record
    // projection or a descendant's derive, under its own owner.
    const subflow: Node[] = [
      { id: "g", position: { x: 5, y: 5 }, parentId: "c", data: { label: "g" } },
      { id: "c", position: { x: 10, y: 10 }, parentId: "p", data: { label: "c" } },
      { id: "p", type: "group", position: { x: 0, y: 0 }, data: {}, width: 300, height: 200 },
    ];
    expect(
      await unexpectedDiagnostics(() =>
        render(() => (
          <SolidFlow defaultNodes={subflow} zIndexMode="auto" width={800} height={600}>
            <MiniMap />
          </SolidFlow>
        )),
      ),
    ).toEqual([]);
  });

  it("custom edges carrying EdgeReconnectAnchors emit no diagnostics", async () => {
    const AnchoredEdge = () => (
      <>
        <EdgeReconnectAnchor type="source" position={{ x: 0, y: 0 }} />
        <EdgeReconnectAnchor type="target" position={{ x: 0, y: 100 }} />
      </>
    );
    const anchored = edges.map((edge) => ({ ...edge, type: "anchored" }));
    expect(
      await unexpectedDiagnostics(() =>
        render(() => (
          <SolidFlow
            defaultNodes={nodes}
            defaultEdges={anchored}
            edgeTypes={{ anchored: AnchoredEdge }}
            width={800}
            height={600}
          />
        )),
      ),
    ).toEqual([]);
  });

  it("a controlled flow fed by signals emits no diagnostics", async () => {
    // The seed is read once at setup (later changes arrive through the
    // controlled reset effects): those reads must be marked untracked, or
    // every signal-backed `nodes`/`edges` prop warns. Found by the hydration lane.
    const [nodeRows] = createSignal(nodes, { name: "test.nodes" });
    const [edgeRows] = createSignal(edges, { name: "test.edges" });
    expect(
      await unexpectedDiagnostics(() =>
        render(() => <SolidFlow nodes={nodeRows()} edges={edgeRows()} width={800} height={600} />),
      ),
    ).toEqual([]);
  });

  it("a programmatic viewport change emits no diagnostics", async () => {
    // setViewport syncs d3-zoom's transform, which calls the pan/zoom
    // callbacks synchronously inside the flow's effect: any signal they read
    // there must be marked untracked. Found through the MiniMap test.
    let ctx!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      ctx = useInternalSolidFlow();
      return null;
    };
    render(() => (
      <SolidFlow defaultNodes={nodes} defaultEdges={edges} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    for (let i = 0; i < 6; i++) await tick();
    expect(
      await unexpectedDiagnostics(() => {
        for (let i = 1; i <= 3; i++) {
          ctx.actions.setViewport({ x: -i * 10, y: -i * 5, zoom: 1 });
          flush();
        }
      }),
    ).toEqual([]);
  });

  it("the id lists subscribe to the arrays' structure, not to every row", async () => {
    // Reading each slot and its id was two sources per row: any flow past ~15
    // nodes reported WIDE_SCOPE_DEPS on visibleNodeIds and visibleEdgeIds.
    const many: Node[] = Array.from({ length: 40 }, (_, i) => ({
      id: `n${i}`,
      position: { x: i * 60, y: 0 },
      data: { label: `${i}` },
      width: 50,
      height: 20,
    }));
    const chain: Edge[] = many.slice(1).map((node, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: node.id,
    }));
    const { artifact } = await captureArtifact(
      async () => {
        render(() => (
          <SolidFlow defaultNodes={many} defaultEdges={chain} width={800} height={600} />
        ));
        for (let i = 0; i < 6; i++) await tick();
      },
      { scenario: "mount", attribution: { log: false } },
    );
    const idLists = artifact.diagnostics
      .map((d) => `${d.code}:${d.nodeName ?? ""}`)
      .filter((key) => /visible(Node|Edge)Ids/.test(key));
    expect(idLists).toEqual([]);
  });
});
