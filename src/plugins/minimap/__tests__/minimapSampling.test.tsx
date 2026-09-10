import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

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
 * when a row's geometry actually changed (the core geometry version) — no
 * periodic full scans of an idle graph.
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

  it("does not run a full graph scan on the idle safety poll when nothing changed", async () => {
    const { internal, viewBox } = renderProbed();
    await tick(20);
    const before = viewBox();
    expect(internal().geometryVersion()).toBeGreaterThan(0);
    const version = internal().geometryVersion();
    await tick(400);
    // Nothing moved: the geometry version is stable, the viewBox is stable.
    expect(internal().geometryVersion()).toBe(version);
    expect(viewBox()).toBe(before);
  });
});
