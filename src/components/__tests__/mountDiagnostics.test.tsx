import { captureArtifact } from "@solidjs/diagnostics";
import { render } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";
import { Background, Controls, MiniMap } from "@/plugins";
import type { Edge, Node } from "@/types";

// Mounting a flow with the built-in nodes, edges and plugins may emit only
// the dev diagnostics that fire by design (docs/ARCHITECTURE.md, "Reactive
// nodes are named"); anything else the engine names is a finding. The one
// that motivated this: STRICT_READ_UNTRACKED, a reactive value read outside
// any tracking scope — a prop or flow setting that stops following changes
// after mount (Handle's `clickConnect`, found this way).
//
// By design, with the reason:
// - `resolvedEdges.row` (~38 sources): an edge's layout reads every key of
//   the edge and both endpoints' geometry; any of them changing must re-lay it.
// - NodeWrapper's element effect: the compiler folds all dynamic attributes
//   of one element into one effect; the per-frame transform has its own.
const BY_DESIGN: ReadonlySet<string> = new Set([
  "WIDE_SCOPE_DEPS:resolvedEdges.row",
  "WIDE_SCOPE_DEPS:div.data-id, div.class, div.style, div.tabindex, div.role, div.aria-describedby",
]);
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
  const unexpected = artifact.diagnostics
    .map((d) =>
      d.code === "STRICT_READ_UNTRACKED"
        ? `${d.code}:${d.data?.strictRead ?? ""} (${d.nodeName ?? "?"})`
        : `${d.code}:${d.nodeName ?? d.ownerName ?? ""}`,
    )
    .filter((key) => !BY_DESIGN.has(key));
  return [...new Set(unexpected)];
};

describe("mount diagnostics", () => {
  it("mounting a flow with built-in nodes, edges and plugins emits only by-design diagnostics", async () => {
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

  it("a controlled flow fed by signals emits only by-design diagnostics", async () => {
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

  it("a programmatic viewport change emits only by-design diagnostics", async () => {
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
});
