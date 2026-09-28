import { captureArtifact } from "@solidjs/diagnostics";
import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { Background, Controls, MiniMap } from "@/plugins";
import type { Edge, Node } from "@/types";

// STRICT_READ_UNTRACKED is the dev engine saying a reactive value was read
// outside any tracking scope: the read got its value once and will never
// update. Every such read in the library is a prop or flow setting that stops
// following changes after mount (Handle's `clickConnect`, found this way).
// Mounting a flow with the built-in nodes, edges and plugins must emit none.
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

describe("strict reads", () => {
  it("mounting a flow with built-in nodes, edges and plugins reads nothing reactive untracked", async () => {
    const { artifact } = await captureArtifact(
      async () => {
        render(() => (
          <SolidFlow defaultNodes={nodes} defaultEdges={edges} width={800} height={600}>
            <Background />
            <Controls />
            <MiniMap />
          </SolidFlow>
        ));
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
    const strict = artifact.diagnostics
      .filter((d) => d.code === "STRICT_READ_UNTRACKED")
      .map((d) => `${d.data?.strictRead ?? ""} (${d.nodeName ?? "?"})`);
    expect(strict).toEqual([]);
  });
});
