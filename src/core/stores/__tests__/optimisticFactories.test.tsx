import { render } from "@solidjs/testing-library";
import { action, refresh } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { createOptimisticEdgeStore, createOptimisticNodeStore } from "@/core";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Typed optimistic factories: thin guided-union wrappers over
 * `createOptimisticStore` (same narrowing as createNodeStore/createEdgeStore;
 * NOT load-bearing — a raw createOptimisticStore works identically, see
 * optimisticCompat.test.tsx).
 */
describe("createOptimisticNodeStore / createOptimisticEdgeStore", () => {
  it("optimistic mutations render mid-action and revert on rejection", async () => {
    const [nodes, setNodes] = createOptimisticNodeStore(async () => [
      { id: "a", type: "default" as const, data: { label: "a" }, position: { x: 0, y: 0 } },
    ]);
    const [edges] = createOptimisticEdgeStore(async () => []);
    const { container } = render(() => (
      <SolidFlow nodes={nodes} edges={edges} width={800} height={600} />
    ));
    await tick();
    const inDom = (id: string) =>
      container.querySelector(`.solid-flow__node[data-id="${id}"]`) !== null;
    expect(inDom("a")).toBe(true);

    let reject!: (err: Error) => void;
    const gate = new Promise<void>((_, r) => (reject = r));
    const add = action(function* () {
      setNodes((draft) => {
        draft.push({ id: "b", type: "default", data: { label: "b" }, position: { x: 200, y: 0 } });
      });
      yield gate;
      refresh(nodes);
    });
    add().catch(() => {});
    await tick();
    expect(inDom("b")).toBe(true); // optimistic, mid-action

    reject(new Error("server said no"));
    await tick(50);
    expect(inDom("b")).toBe(false); // overlay dropped
    expect(inDom("a")).toBe(true);
  });

  it("array form: inline seed, writes inside an action are optimistic", async () => {
    const [nodes, setNodes] = createOptimisticNodeStore([
      { id: "a", type: "default" as const, data: { label: "a" }, position: { x: 0, y: 0 } },
    ]);
    const { container } = render(() => <SolidFlow nodes={nodes} width={800} height={600} />);
    await tick();
    const inDom = (id: string) =>
      container.querySelector(`.solid-flow__node[data-id="${id}"]`) !== null;
    expect(inDom("a")).toBe(true);

    // Outside an action: reverts immediately (upstream optimistic semantics).
    setNodes((draft) => {
      draft.push({ id: "x", type: "default", data: { label: "x" }, position: { x: 99, y: 0 } });
    });
    await tick();
    expect(inDom("x")).toBe(false);

    // Inside an action: visible mid-flight, dropped at settle (no refresh
    // source to confirm against — the array IS the committed truth).
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const add = action(function* () {
      setNodes((draft) => {
        draft.push({ id: "b", type: "default", data: { label: "b" }, position: { x: 200, y: 0 } });
      });
      yield gate;
    });
    void add();
    await tick();
    expect(inDom("b")).toBe(true);
    release();
    await tick(50);
    expect(inDom("b")).toBe(false);
  });
});
