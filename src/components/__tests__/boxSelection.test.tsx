import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

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
 * Drives a box selection on the pane: pointerdown on the pane itself, two
 * moves (the first exceeds paneClickDistance and starts the selection), and
 * pointerup. With a 0/0/1 viewport and jsdom's zero container rect, screen
 * coordinates are flow coordinates.
 */
const boxSelect = async (
  container: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const pane = container.querySelector<HTMLElement>(".solid-flow__pane")!;
  expect(pane).not.toBeNull();
  const pointer = { button: 0, pointerId: 1, isPrimary: true, pointerType: "mouse" };
  fireEvent.pointerDown(pane, { ...pointer, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(pane, { ...pointer, clientX: from.x + 5, clientY: from.y + 5 });
  fireEvent.pointerMove(pane, { ...pointer, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(pane, { ...pointer, clientX: to.x, clientY: to.y });
  // the click a browser fires after the pointer-up; the pane swallows it to
  // end the gesture
  fireEvent.click(pane, { clientX: to.x, clientY: to.y });
  await tick();
};

const renderFlow = (props: Record<string, unknown> = {}) => {
  let api!: ReturnType<typeof useSolidFlow>;
  const Probe = () => {
    api = useSolidFlow();
    return null;
  };
  const rendered = render(() => (
    <SolidFlow
      defaultNodes={[makeNode("a", 0), makeNode("b", 200), makeNode("c", 400)]}
      defaultEdges={[{ id: "ab", source: "a", target: "b" }] as Edge[]}
      width={800}
      height={600}
      panOnDrag={false}
      selectionOnDrag
      {...props}
    >
      <Probe />
    </SolidFlow>
  ));
  const selectedNodes = () =>
    api.flow.nodes
      .filter((node) => node.selected)
      .map((node) => node.id)
      .sort();
  const selectedEdges = () => api.flow.edges.filter((edge) => edge.selected).map((edge) => edge.id);
  return { ...rendered, api: () => api, selectedNodes, selectedEdges };
};

describe("box selection", () => {
  it("replaces the previous selection by default", async () => {
    const { container, api, selectedNodes, selectedEdges } = renderFlow();
    await tick();
    api().updateNode("a", { selected: true });
    api().updateEdge("ab", { selected: true });
    await tick();
    expect(selectedNodes()).toEqual(["a"]);

    await boxSelect(container, { x: 380, y: -10 }, { x: 520, y: 60 });
    expect(selectedNodes()).toEqual(["c"]);
    expect(selectedEdges()).toEqual([]);
  });

  // Upstream parity (xyflow#5960): `deselectOnSelection={false}` keeps the
  // existing selection and adds the boxed elements to it.
  it("deselectOnSelection={false} keeps the previous selection and adds the boxed nodes", async () => {
    const { container, api, selectedNodes, selectedEdges } = renderFlow({
      deselectOnSelection: false,
    });
    await tick();
    api().updateNode("a", { selected: true });
    api().updateEdge("ab", { selected: true });
    await tick();

    await boxSelect(container, { x: 380, y: -10 }, { x: 520, y: 60 });
    expect(selectedNodes()).toEqual(["a", "c"]);
    expect(selectedEdges()).toEqual(["ab"]);
  });

  // Upstream parity (xyflow#6004): `isNodeSelectable` excludes nodes from
  // box selection after they are found inside the rect; click selection is
  // not affected.
  it("isNodeSelectable excludes nodes from the box but not from a click", async () => {
    // Click selection happens on drag start by default (selectNodesOnDrag);
    // off, a plain click selects, which is what jsdom can drive.
    const { container, selectedNodes } = renderFlow({
      isNodeSelectable: (node: Node) => node.id !== "b",
      selectNodesOnDrag: false,
    });
    await tick();

    await boxSelect(container, { x: 180, y: -10 }, { x: 520, y: 60 });
    expect(selectedNodes()).toEqual(["c"]);

    const b = container.querySelector<HTMLElement>('.solid-flow__node[data-id="b"]')!;
    fireEvent.click(b);
    await tick();
    expect(selectedNodes()).toContain("b");
  });
});
