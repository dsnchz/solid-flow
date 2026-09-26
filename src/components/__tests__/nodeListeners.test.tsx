import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

/**
 * The Solid 2 runtime delegates most events to the root but not
 * `pointerenter`, `pointerleave` or `focus`, and a listener the wrapper
 * wires unconditionally is one per node: 8 per node against React Flow's 5
 * and Svelte Flow's 4 at 10k (head-to-head round 1). The pointer pair is
 * attached only when the matching flow prop is passed; focus goes through
 * delegated `focusin` (the handler already guards on the node itself
 * matching `:focus-visible`, so a descendant's focus returns early).
 */
describe("per-node listeners", () => {
  const spy = vi.spyOn(EventTarget.prototype, "addEventListener");
  afterEach(() => spy.mockClear());

  const nodeListeners = (type: string) =>
    spy.mock.calls.filter(
      ([t], i) =>
        t === type &&
        spy.mock.instances[i] instanceof HTMLElement &&
        (spy.mock.instances[i] as HTMLElement).classList.contains("solid-flow__node"),
    ).length;

  it("attaches no pointerenter/pointerleave/focus listener to a node without the matching props", async () => {
    render(() => (
      <SolidFlow
        nodes={[makeNode("a", 0), makeNode("b", 300)]}
        edges={[]}
        width={800}
        height={600}
      />
    ));
    await tick();
    expect(nodeListeners("pointerenter")).toBe(0);
    expect(nodeListeners("pointerleave")).toBe(0);
    expect(nodeListeners("focus")).toBe(0);
  });

  it("attaches the pointer pair when onNodePointerEnter/Leave are passed, and they fire", async () => {
    const events: string[] = [];
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode("a", 0)]}
        edges={[]}
        width={800}
        height={600}
        onNodePointerEnter={({ node, event }) => events.push(`${event.type}:${node.id}`)}
        onNodePointerLeave={({ node, event }) => events.push(`${event.type}:${node.id}`)}
      />
    ));
    await tick();
    expect(nodeListeners("pointerenter")).toBe(1);
    expect(nodeListeners("pointerleave")).toBe(1);
    const el = container.querySelector('.solid-flow__node[data-id="a"]')!;
    fireEvent.pointerEnter(el);
    fireEvent.pointerLeave(el);
    expect(events).toEqual(["pointerenter:a", "pointerleave:a"]);
  });
});
