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
// By-design wide scopes (docs/ARCHITECTURE.md, "Reactive nodes are named"):
// the two record merges.
const ALLOWED_DIAGNOSTICS = new Set(["WIDE_SCOPE_DEPS:selectedIds", "WIDE_SCOPE_DEPS:connections"]);

// Wall-clock diagnostics measure the machine, not the graph: the engine's
// HOT_SCOPE_TIME budget (8 ms of compute per scope per second) trips on a
// slow or busy core and would fail a granularity assertion. Milliseconds are
// the timing benches' job (e2e/bench.spec.ts); every other channel stays on.
const ATTRIBUTION = {
  log: false,
  hotTime: { budgetMs: Number.POSITIVE_INFINITY, windowMs: 1000 },
};

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
    const frame = (x: number) => dragWrite(x, true);
    // The FIRST frame of a drag adds the `dragging` key to the user row,
    // which the row's key-set memo absorbs (one extra scope, once per drag);
    // the budget pins the steady-state frame.
    frame(998);
    const { artifact } = await captureArtifact(() => frame(999), {
      scenario: "drag-frame",
      attribution: ATTRIBUTION,
    });
    expectOnlyByDesignDiagnostics(artifact);
    expectRerunBudget(artifact, 4);
  });

  it("ending a drag writes the overlay entry in place", async () => {
    // The drag's last write flips `dragging`: it must write the entry's
    // leaves like every frame does, not replace the entry with a spread-like
    // copy (IMMUTABLE_UPDATE_IN_STORE — every reader of the entry re-ran for
    // the two leaves that moved; seen on the SSR smoke page).
    dragWrite(700, true);
    dragWrite(701, true);
    const { artifact } = await captureArtifact(() => dragWrite(702, false), {
      scenario: "drag-end",
      attribution: ATTRIBUTION,
    });
    expectOnlyByDesignDiagnostics(artifact);
  });

  const dragWrite = (x: number, dragging: boolean) => {
    flow.actions.updateNodePositions(
      new Map([
        [
          "n5",
          {
            id: "n5",
            position: { x, y: x },
            distance: { x: 0, y: 0 },
            internals: { positionAbsolute: { x, y: x } },
            measured: { width: 50, height: 20 },
          },
        ],
      ]),
      dragging,
    );
    flush();
  };

  it("selecting a node re-runs a bounded set of scopes", async () => {
    const { artifact } = await captureArtifact(
      () => {
        flow.actions.addSelectedNodes(["n7"]);
        flush();
      },
      { scenario: "select", attribution: ATTRIBUTION },
    );
    expectOnlyByDesignDiagnostics(artifact);
    expectRerunBudget(artifact, 10);
  });

  it("a selection write does not re-run the selection views nobody reads", async () => {
    // The joined node view (`flow.selection.nodes`) and the selection-wrapper
    // bounds are O(selected) per write; with no reader (no onSelectionChange,
    // no useSelectedNodes, no NodeSelection) they must stay idle (a zoomed-out
    // box selection rewrites a 6,500-node selection on every move). The edge
    // view stays eager on purpose (createFlowState).
    const { artifact } = await captureArtifact(
      () => {
        flow.actions.addSelectedNodes(["n8"]);
        flush();
      },
      { scenario: "select-unobserved", attribution: ATTRIBUTION },
    );
    expectRerunBudget(artifact, 0, {
      scope: /^(selectedNodesView|selectedNodesBounds)$/,
    });
  });

  it("a reconnect re-runs the edge's row and the connections merge only", async () => {
    const { artifact } = await captureArtifact(
      () => {
        flow.commands.updateEdge("e5", { targetHandle: "in" });
        flush();
      },
      { scenario: "reconnect", attribution: ATTRIBUTION },
    );
    expectOnlyByDesignDiagnostics(artifact);
    expectRerunBudget(artifact, 6);
  });
});
