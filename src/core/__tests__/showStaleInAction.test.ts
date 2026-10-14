// @vitest-environment node
// Headless repro (no DOM, no components): solid-flow's flow state rendered
// through solid-js <For>/<Show> with one eager memo per row. Passes on
// solid-js / @solidjs/signals 2.0.0-rc.13; on rc.14 and rc.15 the action
// below halts the reactive system: REACTIVITY_HALTED, "Attempting to access a
// stale value from <Show>", thrown by the row memo. See REPRO.md.
import { action, createMemo, createOptimisticStore, createRenderEffect, createRoot, flush, For, Show } from "solid-js";
import { expect, it } from "vitest";

import { createFlowState } from "@/core/createFlowState";
import type { Node } from "@/types";

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const node = (id: string, x: number): Node => ({ id, position: { x, y: 0 }, data: {}, width: 100, height: 40 });

it("add + select inside an open action does not halt reactivity", async () => {
  const halted: string[] = [];
  const warn = console.warn, error = console.error;
  console.warn = console.error = (m: unknown) => {
    if (String(m).includes("REACTIVITY_HALTED")) halted.push(String(m).split("\n")[0]!);
  };
  const [nodes] = createOptimisticStore<Node[]>([node("a", 0)]);
  let state!: ReturnType<typeof createFlowState>;
  const rendered: string[] = [];
  createRoot(() => {
    state = createFlowState({ nodes, edges: [] });
    const view = For({
      get each() {
        return state.store.visibleNodeIds;
      },
      children: (id) =>
        Show({
          get when() {
            return state.nodeLookup.get(id);
          },
          children: (row) => {
            const label = createMemo(() => `${row().id}:${row().selected}`);
            return () => label();
          },
        }),
    });
    const resolve = (v: unknown): unknown =>
      typeof v === "function" ? resolve(v()) : Array.isArray(v) ? v.map(resolve) : v;
    createRenderEffect(() => JSON.stringify(resolve(view)), (v) => void rendered.push(v));
  });
  flush();

  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const addAndSelect = action(function* () {
    state.commands.addNodes(node("b", 200));
    state.commands.updateNode("b", { selected: true });
    yield gate;
  });
  void addAndSelect();
  await tick();
  flush();
  release();
  await tick(20);
  console.warn = warn;
  console.error = error;
  expect(halted).toEqual([]);
});
