import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createSolidFlow } from "@/browser/createSolidFlow";
import { createNodeStore, createOptimisticNodeStore } from "@/core/stores/createNodeStore";
import type { Node } from "@/types";

const makeNode = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });
/** The factories' default guided type is the built-in default node (`data.label`). */
const defaultNode = (id: string) => ({
  id,
  type: "default" as const,
  position: { x: 0, y: 0 },
  data: { label: id },
});

/**
 * Every row the flow adopts carries `measured` from the start (empty until
 * the DOM has measured it): the write-through after a measuring pass is then
 * two leaf writes, never a slot that rebuilds the row. Nobody is required
 * to write the key — the flow seeds it on adoption, in every path a row
 * can arrive through (bench round 38).
 */
describe("measured is seeded on adoption", () => {
  it("uncontrolled: default rows carry measured: {} before any measurement", () => {
    const state = createRoot(() => createSolidFlow({ defaultNodes: [makeNode("a")] }));
    flush();
    expect(state.store.nodes[0]!.measured).toEqual({});
    expect("measured" in state.store.nodes[0]!).toBe(true);
    expect(state.internalNodes.a!.measured).toEqual({ width: undefined, height: undefined });
  });

  it("controlled: rows from createNodeStore / createOptimisticNodeStore carry measured: {}", () => {
    const [nodes] = createNodeStore([
      defaultNode("a"),
      { ...defaultNode("b"), measured: { width: 9 } },
    ]);
    expect(nodes[0]!.measured).toEqual({});
    expect(nodes[1]!.measured).toEqual({ width: 9 });
    const [optimistic] = createRoot(() => createOptimisticNodeStore([defaultNode("c")]));
    expect(optimistic[0]!.measured).toEqual({});
  });

  it("controlled: an async node store seeds every promised or streamed row", async () => {
    const [promised] = createRoot(() => createNodeStore(() => Promise.resolve([defaultNode("a")])));
    const [streamed] = createRoot(() =>
      createNodeStore(async function* () {
        yield [defaultNode("b")];
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    flush();
    expect(promised[0]!.measured).toEqual({});
    expect(streamed[0]!.measured).toEqual({});
  });

  it("controlled: a raw store's rows are the user's objects and are left alone until measured", () => {
    const [nodes] = createStore<Node[]>([makeNode("a")]);
    createRoot(() => createSolidFlow({ nodes }));
    flush();
    expect("measured" in nodes[0]!).toBe(false);
  });

  it("a node added later is seeded too, and a user-seeded measured is kept", () => {
    const state = createRoot(() => createSolidFlow({ defaultNodes: [makeNode("a")] }));
    flush();
    state.commands.addNodes([
      makeNode("b"),
      { ...makeNode("c"), measured: { width: 50, height: 20 } },
    ]);
    flush();
    expect(state.store.nodes[1]!.measured).toEqual({});
    expect(state.store.nodes[2]!.measured).toEqual({ width: 50, height: 20 });
  });
});

/**
 * The flow-owned booleans are seeded the same way, as explicit state: a
 * fresh adopted row reads `selected: false` and `dragging: false` rather
 * than an absent key (user decision, 2026-09-26; no performance claim —
 * bench round 43 measured none). A value the user supplied is kept;
 * raw-store rows are left alone until their first write.
 */
describe("selected and dragging are seeded on adoption", () => {
  it("uncontrolled: default rows carry selected: false and dragging: false", () => {
    const state = createRoot(() =>
      createSolidFlow({ defaultNodes: [makeNode("a"), { ...makeNode("b"), selected: true }] }),
    );
    flush();
    const [a, b] = state.store.nodes;
    expect(a!.selected).toBe(false);
    expect(a!.dragging).toBe(false);
    expect("selected" in a! && "dragging" in a!).toBe(true);
    expect(b!.selected).toBe(true);
    expect(state.internalNodes.b!.selected).toBe(true);
    expect(state.internalNodes.a!.selected).toBe(false);
  });

  it("controlled: factory rows and added rows carry both keys", () => {
    const [nodes] = createNodeStore([defaultNode("a")]);
    expect(nodes[0]!.selected).toBe(false);
    expect(nodes[0]!.dragging).toBe(false);
    const state = createRoot(() => createSolidFlow<Node>({ defaultNodes: [] }));
    state.commands.addNodes([makeNode("late")]);
    flush();
    expect(state.store.nodes[0]!.selected).toBe(false);
    expect(state.store.nodes[0]!.dragging).toBe(false);
  });

  it("controlled: a raw store's rows are left alone", () => {
    const [nodes] = createStore<Node[]>([makeNode("a")]);
    createRoot(() => createSolidFlow({ nodes }));
    flush();
    expect("selected" in nodes[0]!).toBe(false);
    expect("dragging" in nodes[0]!).toBe(false);
  });
});
