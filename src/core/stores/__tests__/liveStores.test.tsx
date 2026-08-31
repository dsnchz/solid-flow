import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { createNodeStore } from "@/core";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

// Literal shape (not the broad Node type): the guided-union store narrows
// `data` by `type`, so seeds are typed by inference.
type SeedNode = {
  id: string;
  type: "default";
  position: { x: number; y: number };
  data: { label: string };
  width: number;
  height: number;
};

const makeNode = (id: string, x: number): SeedNode => ({
  id,
  type: "default",
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

/**
 * Live flows (part 3, "A Value That Keeps Arriving"): an async GENERATOR is a
 * first-class store source — unsettled until the first yield, then every
 * yield updates the graph. The natural pairing for `live()` server functions
 * (server-pushed / collaborative graphs).
 */
describe("live (async-iterable) node stores", () => {
  it("streams membership and position updates into a rendered flow", async () => {
    const queue: SeedNode[][] = [];
    let notify: (() => void) | undefined;
    let closed = false;
    const stream = async function* () {
      while (!closed) {
        while (queue.length) yield queue.shift()!;
        if (closed) break;
        await new Promise<void>((resolve) => (notify = resolve));
      }
    };
    const push = (v: SeedNode[]) => {
      queue.push(v);
      notify?.();
    };
    const close = () => {
      closed = true;
      notify?.();
    };

    const [nodes] = createNodeStore(stream);
    const { container } = render(() => <SolidFlow nodes={nodes} width={800} height={600} />);
    await tick();
    const inDom = (id: string) =>
      container.querySelector(`.solid-flow__node[data-id="${id}"]`) !== null;

    // Pre-first-yield: unsettled, nothing rendered.
    expect(container.querySelectorAll(".solid-flow__node")).toHaveLength(0);

    push([makeNode("a", 0)]);
    await tick();
    expect(inDom("a")).toBe(true);

    // Membership grows on a later yield (a "remote user" adds a node)...
    push([makeNode("a", 0), makeNode("b", 300)]);
    await tick();
    expect(inDom("a")).toBe(true);
    expect(inDom("b")).toBe(true);

    // ...and a position-only yield moves the node.
    const el = container.querySelector('.solid-flow__node[data-id="a"]')!;
    push([makeNode("a", 250), makeNode("b", 300)]);
    await tick();
    expect((el as HTMLElement).style.transform).toContain("250px");

    // Removal streams through too.
    push([makeNode("a", 250)]);
    await tick();
    expect(inDom("b")).toBe(false);
    expect(inDom("a")).toBe(true);

    // Stream completion: the store keeps the last yielded state. Completing
    // BEFORE unmount also makes teardown deterministic — a generator parked
    // on a pending next() at dispose leaves a promise reaction racing the
    // iterator cancellation, an upstream window that intermittently wedged
    // the reactive graph into a recompute loop (heap OOM ~1 in 5 full-suite
    // runs; see .agent/spikes/p33-live-store-oom-repro.ts).
    close();
    await tick();
    expect(inDom("a")).toBe(true);
  });
});
