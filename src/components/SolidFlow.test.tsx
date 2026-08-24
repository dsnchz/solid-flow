import { render } from "@solidjs/testing-library";
import { fireEvent } from "@solidjs/testing-library";
import { createStore } from "solid-js/store";
import { describe, expect, it, vi } from "vitest";

import type { Edge, Node, OnSelectionChange } from "~/types";

import { SolidFlow } from "./SolidFlow";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

const makeEdge = (overrides: Partial<Edge> & { id: string; source: string; target: string }) =>
  ({ ...overrides }) as Edge;

const renderFlow = (props: {
  nodes: Node[];
  edges: Edge[];
  nodeTypes?: Record<string, never> | object;
  onSelectionChange?: OnSelectionChange;
}) =>
  render(() => (
    <SolidFlow
      nodes={props.nodes}
      edges={props.edges}
      nodeTypes={props.nodeTypes as never}
      onSelectionChange={props.onSelectionChange}
      width={800}
      height={600}
    />
  ));

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("<SolidFlow />", () => {
  it("renders all non-hidden nodes with their labels", async () => {
    const { container, getByText } = renderFlow({
      nodes: [makeNode({ id: "a" }), makeNode({ id: "b" }), makeNode({ id: "c", hidden: true })],
      edges: [],
    });
    await tick();

    const nodes = container.querySelectorAll(".solid-flow__node");
    expect(nodes).toHaveLength(2);
    expect(getByText("node-a")).toBeInTheDocument();
    expect(getByText("node-b")).toBeInTheDocument();
    expect(container.querySelector('[data-id="c"]')).toBeNull();
  });

  it("measures nodes through the resize-observer pipeline", async () => {
    const { container } = renderFlow({
      nodes: [makeNode({ id: "a" })],
      edges: [],
    });
    await tick();

    // nodeHasDimensions flips the wrapper visible once measurement lands
    const node = container.querySelector<HTMLElement>('[data-id="a"]')!;
    expect(node.style.visibility).toBe("visible");
  });

  it("renders custom node types", async () => {
    const CustomNode = (props: { data: { label: string } }) => (
      <div data-testid="custom-node">custom:{props.data.label}</div>
    );

    const { getByTestId } = renderFlow({
      nodes: [makeNode({ id: "a", type: "special" })],
      edges: [],
      nodeTypes: { special: CustomNode },
    });
    await tick();

    expect(getByTestId("custom-node")).toHaveTextContent("custom:node-a");
  });

  it("renders edges between measured nodes", async () => {
    const { container } = renderFlow({
      nodes: [makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })],
      edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
    });
    await tick();

    const edge = container.querySelector(".solid-flow__edge");
    expect(edge).not.toBeNull();
    expect(edge!.querySelector("path")).not.toBeNull();
  });

  it("selects a node on click and unselects on pane click", async () => {
    const { container } = renderFlow({
      nodes: [makeNode({ id: "a" })],
      edges: [],
    });
    await tick();

    const node = container.querySelector<HTMLElement>('[data-id="a"]')!;
    fireEvent.pointerDown(node, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(node, { button: 0, pointerId: 1 });
    fireEvent.click(node);
    await tick();

    expect(node.classList.contains("selected")).toBe(true);

    const pane = container.querySelector<HTMLElement>(".solid-flow__pane")!;
    fireEvent.click(pane);
    await tick();

    expect(node.classList.contains("selected")).toBe(false);
  });

  it("fires onSelectionChange when the selected set changes", async () => {
    const onSelectionChange = vi.fn();
    const { container } = renderFlow({
      nodes: [makeNode({ id: "a" })],
      edges: [],
      onSelectionChange,
    });
    await tick();

    // fires once on mount with the (empty) initial selection, matching upstream
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ nodes: [], edges: [] });

    const node = container.querySelector<HTMLElement>('[data-id="a"]')!;
    fireEvent.pointerDown(node, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(node, { button: 0, pointerId: 1 });
    fireEvent.click(node);
    await tick();

    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    const lastCall = onSelectionChange.mock.lastCall![0] as { nodes: Node[]; edges: Edge[] };
    expect(lastCall.nodes.map((n) => n.id)).toEqual(["a"]);

    // unrelated updates (e.g. re-clicking the already-selected node) must not re-fire
    fireEvent.click(node);
    await tick();
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
  });

  it("unobserves a removed node's element from the shared ResizeObserver", async () => {
    // Regression: the wrapper's measurement effect unobserved the PREVIOUS
    // element on re-run but nothing unobserved on dispose, so every removed
    // node left its detached element pinned in the shared observer.
    const unobserve = vi.spyOn(ResizeObserver.prototype, "unobserve");
    try {
      const [nodes, setNodes] = createStore<Node[]>([makeNode({ id: "a" }), makeNode({ id: "b" })]);
      const { container } = render(() => (
        <SolidFlow nodes={nodes} edges={[]} width={800} height={600} />
      ));
      await tick();

      const element = container.querySelector<HTMLElement>('[data-id="a"]')!;
      setNodes((prev) => prev.filter((n) => n.id !== "a"));
      await tick();

      expect(container.querySelector('[data-id="a"]')).toBeNull();
      expect(unobserve).toHaveBeenCalledWith(element);
    } finally {
      unobserve.mockRestore();
    }
  });
});
