import { render } from "@solidjs/testing-library";
import { Loading } from "@solidjs/web";
import { describe, expect, it } from "vitest";

import { createEdgeStore, createNodeStore } from "@/core";

import { SolidFlow } from "../SolidFlow";
import { SolidFlowProvider } from "../SolidFlowProvider";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

type SeedNode = {
  id: string;
  type: "default";
  position: { x: number; y: number };
  data: { label: string };
  width: number;
  height: number;
};

// The async-seeded-store contract end to end: a flow whose stores come from
// promises holds behind a <Loading> boundary until the data lands, then
// renders — and behaves like any controlled flow afterwards.
describe("async-seeded flow under a Loading boundary", () => {
  it("shows the fallback, then the graph once both stores resolve", async () => {
    let resolveNodes!: (v: SeedNode[]) => void;
    const nodesRequest = new Promise<SeedNode[]>((resolve) => (resolveNodes = resolve));

    const [nodes] = createNodeStore(async () => await nodesRequest);
    const [edges] = createEdgeStore(async () => [
      { id: "e1", type: "default" as const, source: "a", target: "b" },
    ]);

    const { container } = render(() => (
      <Loading fallback={<div data-testid="loading">loading graph…</div>}>
        <SolidFlow nodes={nodes} edges={edges} width={800} height={600} />
      </Loading>
    ));
    await tick();

    // Unresolved stores: the boundary holds the whole flow.
    expect(container.querySelector('[data-testid="loading"]')).not.toBeNull();
    expect(container.querySelector(".solid-flow__node")).toBeNull();

    resolveNodes([
      {
        id: "a",
        type: "default",
        position: { x: 0, y: 0 },
        data: { label: "a" },
        width: 100,
        height: 40,
      },
      {
        id: "b",
        type: "default",
        position: { x: 200, y: 0 },
        data: { label: "b" },
        width: 100,
        height: 40,
      },
    ]);
    await tick();
    await tick();

    expect(container.querySelector('[data-testid="loading"]')).toBeNull();
    expect(container.querySelectorAll(".solid-flow__node")).toHaveLength(2);
    expect(container.querySelector('.solid-flow__edge[data-id="e1"]')).not.toBeNull();
  });

  it("holds the boundary for PROVIDER-adopted flows too", async () => {
    // The provider creates the flow state before the inner SolidFlow's
    // props exist, so the internal store never carries the async stores'
    // not-readiness — the guard must read the component props (this exact
    // path shipped broken first: the playground wraps every example in a
    // provider, and the fallback never showed there while jsdom's direct
    // render passed).
    let resolveNodes!: (v: SeedNode[]) => void;
    const nodesRequest = new Promise<SeedNode[]>((resolve) => (resolveNodes = resolve));
    const [nodes] = createNodeStore(async () => await nodesRequest);

    const { container } = render(() => (
      <SolidFlowProvider>
        <Loading fallback={<div data-testid="loading">loading…</div>}>
          <SolidFlow nodes={nodes} edges={[]} width={800} height={600} />
        </Loading>
      </SolidFlowProvider>
    ));
    await tick();

    expect(container.querySelector('[data-testid="loading"]')).not.toBeNull();
    expect(container.querySelector(".solid-flow__node")).toBeNull();

    resolveNodes([
      {
        id: "a",
        type: "default",
        position: { x: 0, y: 0 },
        data: { label: "a" },
        width: 100,
        height: 40,
      },
    ]);
    await tick();
    await tick();

    expect(container.querySelector('[data-testid="loading"]')).toBeNull();
    expect(container.querySelectorAll(".solid-flow__node")).toHaveLength(1);
  });
});
