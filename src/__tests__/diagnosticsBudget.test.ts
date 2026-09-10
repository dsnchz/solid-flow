import { captureArtifact, type DiagnosticsArtifact, expectRerunBudget } from "@solidjs/diagnostics";
import { createRoot, flush } from "solid-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSolidFlow } from "@/browser/createSolidFlow";
import type { Edge, Node } from "@/types";

/**
 * CI perf budgets (bench round 25) over the dev-build attribution channel:
 * how many scopes re-run for one gesture write on a 400-node graph, and that
 * none of those re-runs was wasted (recomputed to an unchanged value). The
 * timing benches (e2e/bench.spec.ts, BENCH=1) measure milliseconds; this
 * pins update GRANULARITY, which is what those milliseconds come from.
 *
 * Budgets are measured values with headroom, not targets: drag 2, select 6,
 * reconnect 3 re-runs at the time of writing. Lower them when a round lands.
 * `expectNoWaste` is NOT used: draft-form projections (every per-row derive)
 * return no value, so the attribution channel reports each of their re-runs
 * as "unchanged" and would flag them as waste.
 *
 * Diagnostics that fire BY DESIGN (docs/ARCHITECTURE.md): the keyed record
 * merges (`selectedIds`, `connections`) read one memo per row, which the
 * engine reports as a wide scope. Anything else is a finding.
 */
const ALLOWED_DIAGNOSTICS = new Set(["WIDE_SCOPE_DEPS:selectedIds", "WIDE_SCOPE_DEPS:connections"]);

const expectOnlyByDesignDiagnostics = (artifact: DiagnosticsArtifact) => {
  const unexpected = artifact.diagnostics
    .map((d) => `${d.code}:${d.nodeName ?? d.ownerName ?? ""}`)
    .filter((key) => !ALLOWED_DIAGNOSTICS.has(key));
  expect(unexpected).toEqual([]);
};

describe("reactive update budgets (@solidjs/diagnostics)", () => {
  const N = 400;
  const nodes: Node[] = Array.from({ length: N }, (_, i) => ({
    id: `n${i}`,
    position: { x: (i % 20) * 100, y: Math.floor(i / 20) * 60 },
    data: {},
    width: 50,
    height: 20,
  }));
  const edges: Edge[] = Array.from({ length: N - 1 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i + 1}`,
  }));
  let flow!: ReturnType<typeof createSolidFlow>;
  let dispose!: () => void;

  beforeAll(() => {
    createRoot((d) => {
      dispose = d;
      flow = createSolidFlow({ defaultNodes: nodes, defaultEdges: edges });
    });
    flush();
  });
  afterAll(() => dispose());

  it("a drag frame re-runs only the moved node's scopes", async () => {
    const { artifact } = await captureArtifact(
      () => {
        flow.actions.updateNodePositions(
          new Map([
            [
              "n5",
              {
                id: "n5",
                position: { x: 999, y: 999 },
                distance: { x: 0, y: 0 },
                internals: { positionAbsolute: { x: 999, y: 999 } },
                measured: { width: 50, height: 20 },
              },
            ],
          ]),
          true,
        );
        flush();
      },
      { scenario: "drag-frame" },
    );
    expectOnlyByDesignDiagnostics(artifact);
    expectRerunBudget(artifact, 4);
  });

  it("selecting a node re-runs a bounded set of scopes", async () => {
    const { artifact } = await captureArtifact(
      () => {
        flow.actions.addSelectedNodes(["n7"]);
        flush();
      },
      { scenario: "select" },
    );
    expectOnlyByDesignDiagnostics(artifact);
    expectRerunBudget(artifact, 10);
  });

  it("a reconnect re-runs the edge's row and the connections merge only", async () => {
    const { artifact } = await captureArtifact(
      () => {
        flow.commands.updateEdge("e5", { targetHandle: "in" });
        flush();
      },
      { scenario: "reconnect" },
    );
    expectOnlyByDesignDiagnostics(artifact);
    expectRerunBudget(artifact, 6);
  });
});
