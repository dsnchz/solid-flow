import { fireEvent, render } from "@solidjs/testing-library";
import type { Viewport } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
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

const graph = {
  nodes: [makeNode("a", 0), makeNode("b", 300)],
  edges: [{ id: "e1", source: "a", target: "b" }],
};

// React Flow event-parity additions: double-clicks, edge pointer move, the
// pane surface (scroll + pointer), and programmatic-inclusive viewport
// changes.
describe("event callback parity", () => {
  it("onNodeDoubleClick fires with the user node", async () => {
    const calls: { id: string; type: string }[] = [];
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={graph.nodes}
        defaultEdges={graph.edges}
        width={800}
        height={600}
        onNodeDoubleClick={({ node, event }) => calls.push({ id: node.id, type: event.type })}
      />
    ));
    await tick();

    fireEvent.dblClick(container.querySelector('.solid-flow__node[data-id="a"]')!);
    expect(calls).toEqual([{ id: "a", type: "dblclick" }]);
  });

  it("onEdgeDoubleClick and onEdgePointerMove fire with the edge", async () => {
    const dbl: string[] = [];
    const moves: string[] = [];
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={graph.nodes}
        defaultEdges={graph.edges}
        width={800}
        height={600}
        onEdgeDoubleClick={({ edge }) => dbl.push(edge.id)}
        onEdgePointerMove={({ edge }) => moves.push(edge.id)}
      />
    ));
    await tick();

    const edge = container.querySelector('.solid-flow__edge[data-id="e1"]')!;
    fireEvent.dblClick(edge);
    fireEvent.pointerMove(edge);
    expect(dbl).toEqual(["e1"]);
    expect(moves).toEqual(["e1"]);
  });

  it("pane surface: onPaneScroll and onPanePointerEnter/Move/Leave fire", async () => {
    const events: string[] = [];
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={graph.nodes}
        defaultEdges={graph.edges}
        width={800}
        height={600}
        onPaneScroll={({ event }) => events.push(event.type)}
        onPanePointerEnter={({ event }) => events.push(event.type)}
        onPanePointerMove={({ event }) => events.push(event.type)}
        onPanePointerLeave={({ event }) => events.push(event.type)}
      />
    ));
    await tick();

    const pane = container.querySelector(".solid-flow__pane")!;
    fireEvent.pointerEnter(pane);
    fireEvent.pointerMove(pane);
    fireEvent.pointerLeave(pane);
    fireEvent.wheel(pane);
    expect(events).toEqual(["pointerenter", "pointermove", "pointerleave", "wheel"]);
  });

  it("onViewportChange fires for PROGRAMMATIC viewport changes", async () => {
    const viewports: Viewport[] = [];
    let flowApi!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      flowApi = useSolidFlow();
      return null;
    };
    render(() => (
      <SolidFlow
        defaultNodes={graph.nodes}
        defaultEdges={graph.edges}
        width={800}
        height={600}
        onViewportChange={(viewport) => viewports.push(viewport)}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();
    const before = viewports.length;

    await flowApi.setViewport({ x: 50, y: 25, zoom: 2 });
    await tick();

    expect(viewports.length).toBeGreaterThan(before);
    expect(viewports.at(-1)).toEqual({ x: 50, y: 25, zoom: 2 });
  });
});
