import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

import { MiniMap } from "../MiniMap";

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const nodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

/**
 * Graph bounds feeding the minimap are SAMPLED (never a tracked O(n) memo):
 * per frame during drags through the incremental sampler, and otherwise only
 * when a row's geometry actually changed (the geometry feed's tick), at most
 * every 250 ms — no periodic timer or scan while the graph is idle.
 */
describe("MiniMap bounds sampling", () => {
  const renderProbed = () => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      api = useSolidFlow();
      return null;
    };
    const rendered = render(() => (
      <SolidFlow defaultNodes={nodes} width={800} height={600}>
        <MiniMap />
        <Probe />
      </SolidFlow>
    ));
    const viewBox = () =>
      rendered.container.querySelector(".solid-flow__minimap-svg")!.getAttribute("viewBox")!;
    return { internal: () => internal, api: () => api, viewBox };
  };

  it("follows a programmatic node move outside any drag", async () => {
    const { api, viewBox } = renderProbed();
    await tick(20);
    const before = viewBox();

    api().commands.updateNode("b", { position: { x: 5000, y: 100 } });
    flush();
    await tick(400);
    expect(viewBox()).not.toBe(before);
  });

  it("follows dragged rows frame by frame while dragging", async () => {
    const { internal, viewBox } = renderProbed();
    await tick(20);
    const before = viewBox();

    internal().actions.setDragging(true);
    internal().actions.updateNodePositions(
      new Map([["a", { position: { x: -4000, y: 0 } }]]),
      true,
    );
    flush();
    await tick(60);
    const during = viewBox();
    expect(during).not.toBe(before);

    internal().actions.updateNodePositions(
      new Map([["a", { position: { x: -8000, y: 0 } }]]),
      true,
    );
    flush();
    await tick(60);
    expect(viewBox()).not.toBe(during);

    internal().actions.updateNodePositions(
      new Map([["a", { position: { x: -8000, y: 0 } }]]),
      false,
    );
    internal().actions.setDragging(false);
    flush();
    await tick(60);
    expect(viewBox()).toContain("-8");
  });

  it("keeps no timer armed while the graph is idle", async () => {
    // Pending timers once the flow has settled, with and without a minimap:
    // the minimap re-samples on geometry changes, not on a periodic poll.
    const settledTimers = async (withMiniMap: boolean) => {
      vi.useFakeTimers();
      try {
        const { unmount } = render(() => (
          <SolidFlow defaultNodes={nodes} width={800} height={600}>
            {withMiniMap ? <MiniMap /> : null}
          </SolidFlow>
        ));
        for (let i = 0; i < 20; i++) {
          await vi.advanceTimersByTimeAsync(50);
          flush();
        }
        const count = vi.getTimerCount();
        unmount();
        return count;
      } finally {
        vi.useRealTimers();
      }
    };
    expect(await settledTimers(true)).toBe(await settledTimers(false));
  });
});
