import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

// getIntersectingNodes through the microtask-cached spatial grid must return
// exactly what the old full scan returned, stay consistent across repeated
// same-task calls, and see fresh geometry in the next task.
describe("spatial intersection queries", () => {
  const nodes: Node[] = Array.from({ length: 60 }, (_, i) => ({
    id: `n${i}`,
    position: { x: (i % 10) * 120, y: Math.floor(i / 10) * 90 },
    data: { label: `n${i}` },
    width: 100,
    height: 40,
  }));

  const renderProbed = async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    render(() => (
      <SolidFlow defaultNodes={nodes} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    await tick();
    return api;
  };

  it("matches a brute-force scan for rect queries", async () => {
    const api = await renderProbed();
    const rect = { x: 150, y: 100, width: 500, height: 250 };

    const bruteForce = nodes
      .filter((n) => {
        const r = { x: n.position.x, y: n.position.y, width: 100, height: 40 };
        const ox = Math.min(r.x + r.width, rect.x + rect.width) - Math.max(r.x, rect.x);
        const oy = Math.min(r.y + r.height, rect.y + rect.height) - Math.max(r.y, rect.y);
        return ox > 0 && oy > 0;
      })
      .map((n) => n.id)
      .sort();

    const got = api
      .getIntersectingNodes(rect)
      .map((n) => n.id)
      .sort();
    expect(got).toEqual(bruteForce);

    // Same-task repeat shares the cached grid and must agree.
    const again = api
      .getIntersectingNodes(rect)
      .map((n) => n.id)
      .sort();
    expect(again).toEqual(bruteForce);
  });

  it("sees fresh geometry on the next task after a move", async () => {
    const api = await renderProbed();
    const rect = { x: 2000, y: 2000, width: 200, height: 200 };
    expect(api.getIntersectingNodes(rect)).toHaveLength(0);

    api.updateNode("n0", { position: { x: 2050, y: 2050 } });
    await tick();

    expect(api.getIntersectingNodes(rect).map((n) => n.id)).toEqual(["n0"]);
  });
});
