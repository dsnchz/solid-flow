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
 * Same contract as per-node listeners (nodeListeners.test.tsx): the runtime
 * does not delegate `pointerenter`/`pointerleave`, and `dblclick` is attached
 * directly, so a listener the edge wrapper wires unconditionally is one per
 * edge — three per edge at 10k for callbacks nobody passed (bench round 35).
 */
describe("per-edge listeners", () => {
  const spy = vi.spyOn(EventTarget.prototype, "addEventListener");
  afterEach(() => spy.mockClear());

  const edgeListeners = (type: string) =>
    spy.mock.calls.filter(
      ([t], i) =>
        t === type &&
        spy.mock.instances[i] instanceof Element &&
        (spy.mock.instances[i] as Element).classList.contains("solid-flow__edge"),
    ).length;

  it("attaches no pointerenter/pointerleave/dblclick listener to an edge without the matching props", async () => {
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
      />
    ));
    await tick();
    expect(container.querySelector('.solid-flow__edge[data-id="e1"]')).not.toBeNull();
    expect(edgeListeners("pointerenter")).toBe(0);
    expect(edgeListeners("pointerleave")).toBe(0);
    expect(edgeListeners("dblclick")).toBe(0);
    expect(edgeListeners("pointermove")).toBe(0);
  });

  it("attaches pointermove only when onEdgePointerMove is passed, and it fires with the edge", async () => {
    const moves: string[] = [];
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
        onEdgePointerMove={({ edge, event }) => moves.push(`${event.type}:${edge.id}`)}
      />
    ));
    await tick();
    expect(edgeListeners("pointermove")).toBe(1);
    fireEvent.pointerMove(container.querySelector('.solid-flow__edge[data-id="e1"]')!);
    expect(moves).toEqual(["pointermove:e1"]);
  });

  it("attaches them when the callbacks are passed, and they fire", async () => {
    const events: string[] = [];
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
        onEdgePointerEnter={({ edge, event }) => events.push(`${event.type}:${edge.id}`)}
        onEdgePointerLeave={({ edge, event }) => events.push(`${event.type}:${edge.id}`)}
        onEdgeDoubleClick={({ edge, event }) => events.push(`${event.type}:${edge.id}`)}
      />
    ));
    await tick();
    expect(edgeListeners("pointerenter")).toBe(1);
    expect(edgeListeners("pointerleave")).toBe(1);
    expect(edgeListeners("dblclick")).toBe(1);

    const el = container.querySelector('.solid-flow__edge[data-id="e1"]')!;
    fireEvent.pointerEnter(el);
    fireEvent.pointerLeave(el);
    fireEvent.dblClick(el);
    expect(events).toEqual(["pointerenter:e1", "pointerleave:e1", "dblclick:e1"]);
  });
});
