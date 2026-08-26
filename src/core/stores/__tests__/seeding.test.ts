// @vitest-environment node
import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import type { Node } from "@/types";

import { createSeededGraphStores, type GraphSeedSource } from "../seeding";

const node = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });

// The controlled/uncontrolled policy, headless: no components, no DOM —
// just props, a config signal (standing in for setConfig), and the stores.
const harness = (initial: GraphSeedSource) =>
  createRoot((dispose) => {
    const [config, setConfig] = createSignal<GraphSeedSource>(initial);
    const stores = createSeededGraphStores(initial, config);
    flush();
    return { ...stores, setConfig, dispose };
  });

describe("createSeededGraphStores (headless)", () => {
  it("controlled: seeds from nodes/edges and re-seeds on structural change", () => {
    const a = node("a");
    const h = harness({ nodes: [a], edges: [] });
    expect(h.nodesStore.map((n) => n.id)).toEqual(["a"]);

    // Wholesale replacement through setConfig (the adopted-flow path).
    h.setConfig({ nodes: [node("b"), node("c")], edges: [] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["b", "c"]);
    h.dispose();
  });

  it("uncontrolled: seeds once from defaults; later defaults are ignored", () => {
    const h = harness({ defaultNodes: [node("a")] });
    expect(h.nodesStore.map((n) => n.id)).toEqual(["a"]);

    h.setConfig({ defaultNodes: [node("replacement")] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["a"]);
    h.dispose();
  });

  it("uncontrolled: flow-owned writes survive config churn", () => {
    const h = harness({ defaultNodes: [node("a")] });
    h.setNodesStore((draft) => {
      draft.push(node("added"));
    });
    flush();

    h.setConfig({ defaultNodes: [node("a")] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["a", "added"]);
    h.dispose();
  });

  it("defaults are shallow-copied: membership writes never splice the caller's array", () => {
    const callers = [node("a")];
    const h = harness({ defaultNodes: callers });
    h.setNodesStore((draft) => {
      draft.push(node("b"));
    });
    flush();
    expect(h.nodesStore).toHaveLength(2);
    expect(callers).toHaveLength(1);
    h.dispose();
  });

  it("provider late adoption: a controlled axis arriving via setConfig seeds through the reset path", () => {
    const h = harness({});
    expect(h.nodesStore).toHaveLength(0);

    h.setConfig({ nodes: [node("late")] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["late"]);
    h.dispose();
  });

  it("provider late adoption: defaults arriving via setConfig seed exactly once", () => {
    const h = harness({});
    h.setConfig({ defaultNodes: [node("late")] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["late"]);

    // Second config churn with different defaults: initial-only holds.
    h.setConfig({ defaultNodes: [node("other")] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["late"]);
    h.dispose();
  });

  it("late defaults never adopt over a controlled axis", () => {
    const h = harness({});
    h.setConfig({ nodes: [node("controlled")], defaultNodes: [node("ignored")] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["controlled"]);
    h.dispose();
  });

  it("axes are independent: controlled edges + uncontrolled nodes", () => {
    const h = harness({ edges: [], defaultNodes: [node("a")] });
    expect(h.nodesStore.map((n) => n.id)).toEqual(["a"]);
    // Node axis is uncontrolled: config churn on edges must not reset nodes.
    h.setNodesStore((draft) => {
      draft.push(node("b"));
    });
    h.setConfig({ edges: [], defaultNodes: [node("a")] });
    flush();
    expect(h.nodesStore.map((n) => n.id)).toEqual(["a", "b"]);
    h.dispose();
  });

  it("warns when both props are supplied on one axis", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const h = harness({ nodes: [node("a")], defaultNodes: [node("b")] });
      expect(h.nodesStore.map((n) => n.id)).toEqual(["a"]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("defaultNodes"));
      h.dispose();
    } finally {
      warn.mockRestore();
    }
  });
});
