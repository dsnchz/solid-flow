import { fireEvent, render } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import type { Node } from "@/types";

import { MiniMap } from "../MiniMap";
import { MiniMapNode } from "../MiniMapNode";

// The contract of the default minimap node, pinned before its props handling
// changes (one MiniMapNode per node while a MiniMap is shown).

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const sized = (id: string, x: number, y: number, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: {},
  width: 100,
  height: 40,
  ...extra,
});

const rectOf = (container: HTMLElement, index: number) =>
  container.querySelectorAll<SVGRectElement>(".solid-flow__minimap-node")[index]!;

describe("MiniMapNode (default minimap node)", () => {
  it("draws each node's geometry with the default radius and a shape rendering", async () => {
    const { container } = render(() => (
      <SolidFlow nodes={[sized("a", 10, 20)]} edges={[]} width={800} height={600}>
        <MiniMap />
      </SolidFlow>
    ));
    await tick();

    const rect = rectOf(container, 0);
    expect(rect.getAttribute("x")).toBe("10");
    expect(rect.getAttribute("y")).toBe("20");
    expect(rect.getAttribute("width")).toBe("100");
    expect(rect.getAttribute("height")).toBe("40");
    expect(rect.getAttribute("rx")).toBe("5");
    expect(rect.getAttribute("ry")).toBe("5");
    expect(["crispEdges", "geometricPrecision"]).toContain(rect.getAttribute("shape-rendering"));
  });

  it("takes nodeBorderRadius and nodeStrokeWidth from the MiniMap", async () => {
    const { container } = render(() => (
      <SolidFlow nodes={[sized("a", 0, 0)]} edges={[]} width={800} height={600}>
        <MiniMap nodeBorderRadius={2} nodeStrokeWidth={3} />
      </SolidFlow>
    ));
    await tick();

    const rect = rectOf(container, 0);
    expect(rect.getAttribute("rx")).toBe("2");
    expect(rect.getAttribute("ry")).toBe("2");
    expect(rect.style.strokeWidth).toBe("3");
  });

  it("fills with nodeColor first, then the node's background, then its background-color", async () => {
    const nodes = [
      sized("a", 0, 0, { style: { background: "rgb(255, 0, 0)" } }),
      sized("b", 200, 0, { style: { "background-color": "rgb(0, 0, 255)" } }),
      sized("c", 400, 0),
    ];
    const [color, setColor] = createSignal<string | undefined>(undefined);

    const { container } = render(() => (
      <SolidFlow nodes={nodes} edges={[]} width={800} height={600}>
        <MiniMap nodeColor={color()} />
      </SolidFlow>
    ));
    await tick();

    expect(rectOf(container, 0).style.fill).toBe("rgb(255, 0, 0)");
    expect(rectOf(container, 1).style.fill).toBe("rgb(0, 0, 255)");
    // no color anywhere: no fill key at all, so the stylesheet's fill applies
    expect(rectOf(container, 2).style.fill).toBe("");

    setColor("rgb(0, 128, 0)");
    flush();
    for (const index of [0, 1, 2])
      expect(rectOf(container, index).style.fill).toBe("rgb(0, 128, 0)");
  });

  it("calls a nodeColor function with the user node", async () => {
    const nodeColor = vi.fn((node: Node) => (node.id === "a" ? "rgb(1, 2, 3)" : "rgb(4, 5, 6)"));

    const { container } = render(() => (
      <SolidFlow nodes={[sized("a", 0, 0), sized("b", 200, 0)]} edges={[]} width={800} height={600}>
        <MiniMap nodeColor={nodeColor} />
      </SolidFlow>
    ));
    await tick();

    expect(rectOf(container, 0).style.fill).toBe("rgb(1, 2, 3)");
    expect(rectOf(container, 1).style.fill).toBe("rgb(4, 5, 6)");
    expect(new Set(nodeColor.mock.calls.map(([node]) => node.id))).toEqual(new Set(["a", "b"]));
    expect(nodeColor.mock.calls[0]![0]).not.toHaveProperty("internals");
  });

  it("strokes transparent at width 2 by default, and takes nodeStrokeColor as a value or function", async () => {
    const [stroke, setStroke] = createSignal<string | ((node: Node) => string) | undefined>(
      undefined,
    );

    const { container } = render(() => (
      <SolidFlow nodes={[sized("a", 0, 0), sized("b", 200, 0)]} edges={[]} width={800} height={600}>
        <MiniMap nodeStrokeColor={stroke()} />
      </SolidFlow>
    ));
    await tick();

    expect(rectOf(container, 0).style.stroke).toBe("transparent");
    expect(rectOf(container, 0).style.strokeWidth).toBe("2");

    setStroke("rgb(9, 9, 9)");
    flush();
    expect(rectOf(container, 1).style.stroke).toBe("rgb(9, 9, 9)");

    setStroke(() => (node: Node) => (node.id === "b" ? "rgb(7, 7, 7)" : "rgb(8, 8, 8)"));
    flush();
    expect(rectOf(container, 0).style.stroke).toBe("rgb(8, 8, 8)");
    expect(rectOf(container, 1).style.stroke).toBe("rgb(7, 7, 7)");
  });

  it("classes: the base class, `selected` while the node is, and nodeClass as a value or function", async () => {
    const [nodes, setNodes] = createSignal<Node[]>([sized("a", 0, 0), sized("b", 200, 0)]);
    const [nodeClass, setNodeClass] = createSignal<string | ((node: Node) => string)>("mini");

    const { container } = render(() => (
      <SolidFlow nodes={nodes()} edges={[]} width={800} height={600}>
        <MiniMap nodeClass={nodeClass()} />
      </SolidFlow>
    ));
    await tick();

    expect(rectOf(container, 0).getAttribute("class")).toBe("solid-flow__minimap-node mini");

    setNodes([sized("a", 0, 0, { selected: true }), sized("b", 200, 0)]);
    flush();
    expect(rectOf(container, 0).classList.contains("selected")).toBe(true);
    expect(rectOf(container, 1).classList.contains("selected")).toBe(false);

    setNodes([sized("a", 0, 0), sized("b", 200, 0)]);
    flush();
    expect(rectOf(container, 0).classList.contains("selected")).toBe(false);

    setNodeClass(() => (node: Node) => `mini-${node.id}`);
    flush();
    expect(rectOf(container, 1).getAttribute("class")).toBe("solid-flow__minimap-node mini-b");
  });

  it("follows the node's position", async () => {
    const [nodes, setNodes] = createSignal<Node[]>([sized("a", 0, 0)]);

    const { container } = render(() => (
      <SolidFlow nodes={nodes()} edges={[]} width={800} height={600}>
        <MiniMap />
      </SolidFlow>
    ));
    await tick();

    setNodes([sized("a", 30, 60)]);
    flush();
    await tick();

    const rect = rectOf(container, 0);
    expect(rect.getAttribute("x")).toBe("30");
    expect(rect.getAttribute("y")).toBe("60");
  });

  it("draws no hidden node, and draws it again once shown", async () => {
    const [nodes, setNodes] = createSignal<Node[]>([
      sized("a", 0, 0),
      sized("b", 200, 0, { hidden: true }),
    ]);

    const { container } = render(() => (
      <SolidFlow nodes={nodes()} edges={[]} width={800} height={600}>
        <MiniMap />
      </SolidFlow>
    ));
    await tick();
    expect(container.querySelectorAll(".solid-flow__minimap-node")).toHaveLength(1);

    setNodes([sized("a", 0, 0), sized("b", 200, 0)]);
    flush();
    await tick();
    expect(container.querySelectorAll(".solid-flow__minimap-node")).toHaveLength(2);
  });

  it("on its own: zero size, radius 5, no fill or stroke, and onClick gets its id", () => {
    const onClick = vi.fn();
    const { container } = render(() => (
      <svg>
        <MiniMapNode id="n1" x={1} y={2} shapeRendering="crispEdges" onClick={onClick} />
      </svg>
    ));

    const rect = container.querySelector<SVGRectElement>(".solid-flow__minimap-node")!;
    expect(rect.getAttribute("width")).toBe("0");
    expect(rect.getAttribute("height")).toBe("0");
    expect(rect.getAttribute("rx")).toBe("5");
    expect(rect.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(rect.style.fill).toBe("");
    expect(rect.style.stroke).toBe("");
    expect(rect.style.strokeWidth).toBe("");

    fireEvent.click(rect);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]![1]).toBe("n1");
  });
});
