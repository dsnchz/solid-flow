import { fireEvent, render } from "@solidjs/testing-library";
import { getEdgeToolbarTransform, getNodeToolbarTransform, Position } from "@xyflow/system";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node, NodeProps } from "@/types";

import { EdgeToolbar } from "../EdgeToolbar";
import { NodeToolbar, type NodeToolbarProps } from "../NodeToolbar";

// The props contract of the two toolbars (none was pinned), written before
// their props handling changes: one toolbar per node or edge that carries
// one, hidden until it is shown.

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const node = (id: string, x: number, extra: Partial<Node> = {}): Node => ({
  id,
  type: "tb",
  position: { x, y: 0 },
  data: {},
  width: 100,
  height: 40,
  ...extra,
});

const renderNodes = async (
  toolbar: (props: NodeProps) => ReturnType<typeof NodeToolbar>,
  initial: Node[],
) => {
  const [nodes, setNodes] = createSignal(initial);
  let api!: ReturnType<typeof useSolidFlow>;
  const Probe = () => ((api = useSolidFlow()), null);
  const { container } = render(() => (
    <SolidFlow nodes={nodes()} nodeTypes={{ tb: toolbar }} width={800} height={600}>
      <Probe />
    </SolidFlow>
  ));
  await tick();
  const toolbars = () =>
    Array.from(container.querySelectorAll<HTMLDivElement>(".solid-flow__node-toolbar"));
  return { container, toolbars, setNodes, api: () => api };
};

describe("NodeToolbar", () => {
  it("shows while its node is the only selected node", async () => {
    const { toolbars, setNodes } = await renderNodes(
      (props) => <NodeToolbar nodeId={props.id}>tools</NodeToolbar>,
      [node("a", 0), node("b", 200)],
    );
    expect(toolbars()).toHaveLength(0);

    setNodes([node("a", 0, { selected: true }), node("b", 200)]);
    flush();
    expect(toolbars().map((el) => el.getAttribute("data-id"))).toEqual(["a"]);
    expect(toolbars()[0]!.textContent).toBe("tools");

    setNodes([node("a", 0, { selected: true }), node("b", 200, { selected: true })]);
    flush();
    expect(toolbars()).toHaveLength(0);
  });

  it("follows isVisible over the selection, and takes its node id from the node", async () => {
    const [visible, setVisible] = createSignal<boolean | undefined>(true);
    const { toolbars } = await renderNodes(
      () => <NodeToolbar isVisible={visible()} />,
      [node("a", 0, { selected: true }), node("b", 200)],
    );
    expect(toolbars().map((el) => el.getAttribute("data-id"))).toEqual(["a", "b"]);

    setVisible(false);
    flush();
    expect(toolbars()).toHaveLength(0);
  });

  it("sits in the flow element, placed by position, align and offset above its node", async () => {
    const [props, setProps] = createSignal<Partial<NodeToolbarProps>>({});
    const { container, toolbars, api } = await renderNodes(
      (p) => (
        <NodeToolbar
          nodeId={p.id}
          isVisible
          position={props().position}
          align={props().align}
          offset={props().offset}
        />
      ),
      [node("a", 0)],
    );
    const el = toolbars()[0]!;
    expect(el.parentElement).toBe(container.querySelector(".solid-flow"));
    const rect = { x: 0, y: 0, width: 100, height: 40 };
    const viewport = { x: 0, y: 0, zoom: 1 };
    expect(el.style.transform).toBe(
      getNodeToolbarTransform(rect, viewport, Position.Top, 10, "center"),
    );
    expect(el.style.position).toBe("absolute");
    const z = api().flow.internalNodes.a!.internals.z;
    expect(el.style.zIndex).toBe(String((z || 5) + 1));

    setProps({ position: "bottom", align: "start", offset: 4 });
    flush();
    expect(el.style.transform).toBe(
      getNodeToolbarTransform(rect, viewport, Position.Bottom, 4, "start"),
    );
  });

  it("spans every node of an id list", async () => {
    const { toolbars } = await renderNodes(
      (props) => (props.id === "a" ? <NodeToolbar nodeId={["a", "b"]} isVisible /> : null),
      [node("a", 0), node("b", 200)],
    );
    expect(toolbars().map((el) => el.getAttribute("data-id"))).toEqual(["a b"]);
    expect(toolbars()[0]!.style.transform).toBe(
      getNodeToolbarTransform(
        { x: 0, y: 0, width: 300, height: 40 },
        { x: 0, y: 0, zoom: 1 },
        Position.Top,
        10,
        "center",
      ),
    );
  });

  it("keeps its own class next to the user's", async () => {
    const { container } = await renderNodes(
      (props) => <NodeToolbar nodeId={props.id} isVisible class="mine" />,
      [node("a", 0)],
    );
    const el = container.querySelector(".mine")!;
    expect(el.getAttribute("class")).toBe("solid-flow__node-toolbar mine");
  });

  it("takes the user's style and extra attributes", async () => {
    const { toolbars } = await renderNodes(
      (props) => (
        <NodeToolbar nodeId={props.id} isVisible style={{ opacity: "0.5" }} data-testid="tb" />
      ),
      [node("a", 0)],
    );
    const el = toolbars()[0]!;
    expect(el.style.opacity).toBe("0.5");
    expect(el.getAttribute("data-testid")).toBe("tb");
  });
});

const renderEdge = async (content: () => ReturnType<typeof EdgeToolbar>, initial: Edge) => {
  const [edges, setEdges] = createSignal<Edge[]>([initial]);
  const nodes: Node[] = [
    { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
    { id: "b", position: { x: 300, y: 0 }, data: {}, width: 100, height: 40 },
  ];
  let api!: ReturnType<typeof useSolidFlow>;
  const Probe = () => ((api = useSolidFlow()), null);
  const { container } = render(() => (
    <SolidFlow
      nodes={nodes}
      edges={edges()}
      edgeTypes={{ tb: () => content() }}
      width={800}
      height={600}
    >
      <Probe />
    </SolidFlow>
  ));
  await tick();
  const toolbar = () => container.querySelector<HTMLDivElement>(".solid-flow__edge-toolbar");
  return { container, toolbar, setEdges, api: () => api };
};

const edge = (extra: Partial<Edge> = {}): Edge => ({
  id: "e1",
  source: "a",
  target: "b",
  type: "tb",
  ...extra,
});

describe("EdgeToolbar", () => {
  it("shows while its edge is selected, or as isVisible says", async () => {
    const { toolbar, setEdges } = await renderEdge(
      () => (
        <EdgeToolbar x={10} y={20}>
          tools
        </EdgeToolbar>
      ),
      edge(),
    );
    expect(toolbar()).toBeNull();

    setEdges([edge({ selected: true })]);
    flush();
    expect(toolbar()!.textContent).toBe("tools");

    const forced = await renderEdge(() => <EdgeToolbar x={0} y={0} isVisible />, edge());
    expect(forced.toolbar()).not.toBeNull();
  });

  it("sits in a transparent label of the label layer, placed by x, y and its alignment", async () => {
    const { toolbar } = await renderEdge(
      () => <EdgeToolbar x={10} y={20} alignX="left" alignY="bottom" isVisible />,
      edge(),
    );
    const el = toolbar()!;
    expect(el.getAttribute("data-id")).toBe("e1");
    expect(el.style.position).toBe("absolute");
    expect(el.style.transform).toBe(getEdgeToolbarTransform(10, 20, 1, "left", "bottom"));
    const label = el.parentElement!;
    expect(label.classList.contains("solid-flow__edge-label")).toBe(true);
    expect(label.classList.contains("transparent")).toBe(true);
    expect(label.parentElement!.classList.contains("solid-flow__edge-labels")).toBe(true);
  });

  it("takes the user's class and extra attributes", async () => {
    const { toolbar } = await renderEdge(
      () => <EdgeToolbar x={0} y={0} isVisible class="mine" data-testid="etb" />,
      edge(),
    );
    expect(toolbar()!.getAttribute("class")).toBe("solid-flow__edge-toolbar mine");
    expect(toolbar()!.getAttribute("data-testid")).toBe("etb");
  });

  it("selects its edge on click with selectEdgeOnClick", async () => {
    const { toolbar, api } = await renderEdge(
      () => <EdgeToolbar x={0} y={0} isVisible selectEdgeOnClick />,
      edge(),
    );
    fireEvent.click(toolbar()!);
    flush();
    expect(api().flow.edges[0]!.selected).toBe(true);
  });
});
