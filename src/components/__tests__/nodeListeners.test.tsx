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
    expect(nodeListeners("pointermove")).toBe(0);
    expect(nodeListeners("focus")).toBe(0);
  });

  it("attaches pointermove only when onNodePointerMove is passed, and it fires with the node", async () => {
    const moves: string[] = [];
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode("a", 0)]}
        edges={[]}
        width={800}
        height={600}
        onNodePointerMove={({ node, event }) => moves.push(`${event.type}:${node.id}`)}
      />
    ));
    await tick();
    expect(nodeListeners("pointermove")).toBe(1);
    fireEvent.pointerMove(container.querySelector('.solid-flow__node[data-id="a"]')!);
    expect(moves).toEqual(["pointermove:a"]);
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

  it("attaches dblclick only when onNodeDoubleClick is passed, and it fires", async () => {
    render(() => <SolidFlow nodes={[makeNode("a", 0)]} edges={[]} width={800} height={600} />);
    await tick();
    expect(nodeListeners("dblclick")).toBe(0);
    spy.mockClear();

    const events: string[] = [];
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode("b", 0)]}
        edges={[]}
        width={800}
        height={600}
        onNodeDoubleClick={({ node, event }) => events.push(`${event.type}:${node.id}`)}
      />
    ));
    await tick();
    expect(nodeListeners("dblclick")).toBe(1);
    fireEvent.dblClick(container.querySelector('.solid-flow__node[data-id="b"]')!);
    expect(events).toEqual(["dblclick:b"]);
  });
});

/**
 * A pointer move is the one event a drag fires per frame. Solid delegates
 * `pointermove` to the render root once any module registers it, and the
 * delegated dispatch then walks every ancestor of the pointer on every move
 * (composedPath, per-ancestor handler and `_bnd` probes, three
 * defineProperty calls): ~45 us of a ~470 us drag move at 10k (bench round
 * 49). The library registers none: the pane listens directly (box selection,
 * onPanePointerMove), and rows attach one only for a user callback.
 */
describe("pointermove", () => {
  const spy = vi.spyOn(EventTarget.prototype, "addEventListener");
  afterEach(() => spy.mockClear());

  it("a flow without row pointer-move callbacks has exactly one pointermove listener: the pane's", async () => {
    render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
      />
    ));
    await tick();
    const targets = spy.mock.calls
      .map(([type], i) => (type === "pointermove" ? spy.mock.instances[i] : undefined))
      .filter((target) => target !== undefined)
      .map((target) =>
        target instanceof Element
          ? (target.getAttribute("class") ?? target.tagName)
          : String(target),
      );
    expect(targets).toEqual([expect.stringContaining("solid-flow__pane")]);
  });
});
