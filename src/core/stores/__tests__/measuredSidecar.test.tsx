import { render } from "@solidjs/testing-library";
import { createOptimisticStore, createStore } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const makeNode = (id: string, x: number, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  ...extra,
});

/**
 * Measured slice of the #3085 sidecar composition: the measurements root is
 * authoritative for rendering and initialization; the row write-through
 * (applyNodeChanges) stays best-effort for the parity contract. Correctness
 * must not depend on the row write landing — on optimistic stores it reverts.
 */
describe("measured sidecar", () => {
  const renderFlow = (nodes: readonly Node[]) => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      return null;
    };
    const utils = render(() => (
      <SolidFlow nodes={nodes as Node[]} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    // One browser measuring pass: sidecar write + best-effort row write.
    const measure = (id: string, width: number, height: number) => {
      internal.actions.applyMeasurementWrites([
        { id, measured: { width, height }, handleBounds: { source: [], target: [] } },
      ]);
      internal.actions.applyNodeChanges([
        { id, type: "dimensions", dimensions: { width, height }, setAttributes: false },
      ]);
    };
    return { ...utils, internal: () => internal, measure };
  };

  it("nodesInitialized turns true over an OPTIMISTIC store once measurements land", async () => {
    const api = { list: async () => [makeNode("a", 0), makeNode("b", 300)] };
    const [nodes] = createOptimisticStore<Node[]>(() => api.list(), []);
    const { internal, measure } = renderFlow(nodes);
    await tick();

    expect(internal().store.nodesInitialized).toBe(false);
    measure("a", 100, 40);
    measure("b", 100, 40);
    await tick();
    // The row write-through reverted; the measurements root must carry it.
    expect(internal().store.nodesInitialized).toBe(true);
  });

  it("a fresh DOM measurement supersedes a stale user-seeded `measured` on an OPTIMISTIC store", async () => {
    const api = {
      list: async () => [makeNode("a", 0, { measured: { width: 50, height: 20 } })],
    };
    const [nodes] = createOptimisticStore<Node[]>(() => api.list(), []);
    const { internal, measure } = renderFlow(nodes);
    await tick();

    // Pre-measurement: the user seed governs (SSR-style sizing).
    expect(internal().nodeLookup.get("a")!.measured.width).toBe(50);

    measure("a", 120, 60);
    await tick();
    expect(internal().nodeLookup.get("a")!.measured).toEqual({ width: 120, height: 60 });
  });

  it("plain stores keep the measured write-through parity contract", async () => {
    const [nodes] = createStore<Node[]>([makeNode("a", 0)]);
    const { measure } = renderFlow(nodes);
    await tick();

    measure("a", 100, 40);
    await tick();
    // Best-effort write-through landed in the USER's store.
    expect(nodes[0]!.measured).toEqual({ width: 100, height: 40 });
  });
});
