// @vitest-environment node
import { isProxy } from "node:util/types";

import { createRoot, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "@/types";

import { createFlowState } from "../createFlowState";
import { getDefaultFlowStateProps } from "../defaults";
import { FLOW_PROP_KEYS } from "../flowProps";

const makeNode = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });

/**
 * The internal `store` is the read surface every wrapper hits dozens of
 * times per row. Its config-backed keys must be plain getters over the
 * config signal — NOT a memo-backed merge source: reading a memo pulls the
 * dirty heap (`markHeap`), and during a 10k mount that path was ~5s of the
 * 12s (mount profile, bench round 17).
 */
describe("internal store surface", () => {
  const setup = (props: Partial<Parameters<typeof createFlowState>[0]> = {}) => {
    let state!: ReturnType<typeof createFlowState>;
    let dispose!: () => void;
    createRoot((d) => {
      dispose = d;
      state = createFlowState({ nodes: [makeNode("a")], edges: [], ...props });
    });
    flush();
    return { state, dispose };
  };

  it("is a plain object with own getters, not a proxy over a memo-backed source", () => {
    const { state, dispose } = setup();
    expect(isProxy(state.store)).toBe(false);
    const own = new Set(Object.getOwnPropertyNames(state.store));
    for (const key of FLOW_PROP_KEYS) expect(own.has(key)).toBe(true);
    dispose();
  });

  it("exposes defaults and follows a config swap for every flow prop", () => {
    const { state, dispose } = setup();
    const defaults = getDefaultFlowStateProps();
    expect(state.store.minZoom).toBe(defaults.minZoom);
    expect(state.store.nodesDraggable).toBe(defaults.nodesDraggable);

    state.actions.setConfig({
      ...defaults,
      nodes: [makeNode("a")],
      edges: [],
      minZoom: 0.25,
      nodesDraggable: false,
    });
    flush();
    expect(state.store.minZoom).toBe(0.25);
    expect(state.store.nodesDraggable).toBe(false);
    dispose();
  });

  it("keeps the derived getters authoritative over raw config", () => {
    const { state, dispose } = setup({ colorMode: "dark" });
    // colorMode is resolved (system -> light/dark); nodes come from the seeded store.
    expect(state.store.colorMode).toBe("dark");
    expect(state.store.nodes.map((n) => n.id)).toEqual(["a"]);
    // width/height are the container-measurement signals, not config reads.
    state.actions.setWidth(800);
    flush();
    expect(state.store.width).toBe(800);
    dispose();
  });
});
