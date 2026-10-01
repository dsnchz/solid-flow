import { fireEvent, render } from "@solidjs/testing-library";
import type { Connection, XYHandle } from "@xyflow/system";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node, OnBeforeReconnect } from "@/types";

import { EdgeReconnectAnchor } from "../EdgeReconnectAnchor";

// jsdom cannot drive XYHandle's pointer gesture, so the system boundary is
// replaced: the anchor's pointerdown hands its gesture params to the mock,
// and the test ends the gesture by calling them the way XYHandle does.
type OnPointerDownParams = Parameters<typeof XYHandle.onPointerDown>[1];

const gesture = vi.hoisted(() => ({ params: undefined as OnPointerDownParams | undefined }));

vi.mock("@xyflow/system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/system")>();
  return {
    ...actual,
    XYHandle: {
      ...actual.XYHandle,
      onPointerDown: (_event: MouseEvent | TouchEvent, params: OnPointerDownParams) => {
        gesture.params = params;
      },
    },
  };
});

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const ReconnectableEdge = () => <EdgeReconnectAnchor type="target" position={{ x: 0, y: 0 }} />;

const nodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 300, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "c", position: { x: 300, y: 200 }, data: {}, width: 100, height: 40 },
];

const edges: Edge[] = [
  { id: "e1", source: "a", target: "b", type: "reconnectable" },
  { id: "e2", source: "b", target: "c" },
];

const toC: Connection = { source: "a", target: "c", sourceHandle: null, targetHandle: null };

const renderFlow = async (props: {
  onBeforeReconnect?: OnBeforeReconnect;
  onReconnect?: (oldEdge: Edge, connection: Connection) => void;
  onReconnectEnd?: (event: MouseEvent | TouchEvent, edge: Edge) => void;
}) => {
  gesture.params = undefined;
  let api!: ReturnType<typeof useSolidFlow>;
  const Probe = () => ((api = useSolidFlow()), null);
  const { container } = render(() => (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      edgeTypes={{ reconnectable: ReconnectableEdge }}
      width={800}
      height={600}
      {...props}
    >
      <Probe />
    </SolidFlow>
  ));
  await tick();
  const anchor = container.querySelector(".solid-flow__edgeupdater-target")!;
  fireEvent.pointerDown(anchor, { button: 0, clientX: 300, clientY: 20 });
  return { api, params: () => gesture.params! };
};

describe("EdgeReconnectAnchor", () => {
  it("passes the edge as it was before the reconnect to onReconnect and onReconnectEnd", async () => {
    const onReconnect = vi.fn();
    const onReconnectEnd = vi.fn();
    const { api, params } = await renderFlow({ onReconnect, onReconnectEnd });

    params().onConnect!(toC);
    // A flush between the two (a user handler that flushes, or a later
    // pointerup) must not turn the "old" edge into the reconnected one.
    await tick();
    params().onReconnectEnd!(new MouseEvent("mouseup"), { isValid: true } as never);

    expect(api.flow.edges.find((e) => e.id === "e1")).toMatchObject({ source: "a", target: "c" });
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(onReconnect.mock.calls[0]![0]).toMatchObject({ id: "e1", source: "a", target: "b" });
    expect(onReconnect.mock.calls[0]![1]).toEqual(toC);
    expect(onReconnectEnd.mock.calls[0]![1]).toMatchObject({ id: "e1", target: "b" });
  });

  it("cancels when onBeforeReconnect returns undefined: no write, no onReconnect", async () => {
    const onReconnect = vi.fn();
    const onBeforeReconnect = vi.fn(() => undefined);
    const { api, params } = await renderFlow({ onBeforeReconnect, onReconnect });

    params().onConnect!(toC);
    await tick();

    expect(onBeforeReconnect).toHaveBeenCalledTimes(1);
    expect(api.flow.edges.find((e) => e.id === "e1")).toMatchObject({ target: "b" });
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it("writes the edge onBeforeReconnect returns, which may carry a new id", async () => {
    const onBeforeReconnect: OnBeforeReconnect = (newEdge) => ({ ...newEdge, id: "e1-c" });
    const { api, params } = await renderFlow({ onBeforeReconnect });

    params().onConnect!(toC);
    await tick();

    expect(api.flow.edges.map((e) => e.id)).toEqual(["e1-c", "e2"]);
    expect(api.flow.edges[0]).toMatchObject({ source: "a", target: "c" });
    expect(api.flow.edges[1]).toMatchObject({ id: "e2", source: "b", target: "c" });
  });
});

// The anchor's own contract (as Svelte Flow's EdgeReconnectAnchor: one
// element, the edge label itself, carrying the updater classes and size).
const renderAnchor = async (
  anchor: () => ReturnType<typeof EdgeReconnectAnchor>,
  connectionDragThreshold?: number,
) => {
  gesture.params = undefined;
  const AnchorEdge = () => anchor();
  const { container } = render(() => (
    <SolidFlow
      nodes={nodes}
      edges={[{ id: "e1", source: "a", target: "b", type: "anchor" }]}
      edgeTypes={{ anchor: AnchorEdge }}
      connectionDragThreshold={connectionDragThreshold}
      width={800}
      height={600}
    />
  ));
  await tick();
  const element = () => container.querySelector<HTMLDivElement>(".solid-flow__edgeupdater")!;
  return { container, element };
};

describe("EdgeReconnectAnchor props", () => {
  it("is one element in the label layer: the edge label with the updater classes", async () => {
    const { container, element } = await renderAnchor(() => (
      <EdgeReconnectAnchor type="target" class="mine" />
    ));

    expect(container.querySelectorAll(".solid-flow__edgeupdater")).toHaveLength(1);
    expect(element().getAttribute("class")).toBe(
      "solid-flow__edge-label transparent solid-flow__edgeupdater solid-flow__edgeupdater-target nopan mine",
    );
    expect(element().parentElement!.classList.contains("solid-flow__edge-labels")).toBe(true);
  });

  it("takes size as its width and height, 25 by default, at its position", async () => {
    const { element } = await renderAnchor(() => (
      <EdgeReconnectAnchor type="source" position={{ x: 10, y: 20 }} />
    ));
    expect(element().style.width).toBe("25px");
    expect(element().style.height).toBe("25px");
    expect(element().style.transform).toContain("translate(10px,20px)");

    const sized = await renderAnchor(() => <EdgeReconnectAnchor type="source" size={40} />);
    expect(sized.element().style.width).toBe("40px");
  });

  it("puts the user's style and extra attributes on the element", async () => {
    const { element } = await renderAnchor(() => (
      <EdgeReconnectAnchor type="target" style={{ opacity: "0.5" }} data-testid="anchor" />
    ));
    expect(element().style.opacity).toBe("0.5");
    expect(element().getAttribute("data-testid")).toBe("anchor");
  });

  it("hides its children while reconnecting and reports the state", async () => {
    const onReconnectingChange = vi.fn();
    const { element } = await renderAnchor(() => (
      <EdgeReconnectAnchor type="target" onReconnectingChange={onReconnectingChange}>
        <span class="grip" />
      </EdgeReconnectAnchor>
    ));
    expect(element().querySelector(".grip")).not.toBeNull();

    fireEvent.pointerDown(element(), { button: 0, clientX: 300, clientY: 20 });
    flush();
    expect(onReconnectingChange).toHaveBeenLastCalledWith(true);
    expect(element().querySelector(".grip")).toBeNull();

    gesture.params!.onReconnectEnd!(new MouseEvent("mouseup"), { isValid: false } as never);
    flush();
    expect(onReconnectingChange).toHaveBeenLastCalledWith(false);
    expect(element().querySelector(".grip")).not.toBeNull();
  });

  it("hides its children while the reconnecting prop is set", async () => {
    const [reconnecting, setReconnecting] = createSignal(false);
    const { element } = await renderAnchor(() => (
      <EdgeReconnectAnchor type="target" reconnecting={reconnecting()}>
        <span class="grip" />
      </EdgeReconnectAnchor>
    ));
    expect(element().querySelector(".grip")).not.toBeNull();
    setReconnecting(true);
    flush();
    expect(element().querySelector(".grip")).toBeNull();
  });

  it("starts a gesture on a primary-button pointerdown only", async () => {
    const { element } = await renderAnchor(() => <EdgeReconnectAnchor type="target" />);
    fireEvent.pointerDown(element(), { button: 2 });
    expect(gesture.params).toBeUndefined();
    fireEvent.pointerDown(element(), { button: 0, clientX: 300, clientY: 20 });
    expect(gesture.params).toBeDefined();
  });

  it("hands XYHandle its dragThreshold, or the flow's connectionDragThreshold", async () => {
    const own = await renderAnchor(() => <EdgeReconnectAnchor type="target" dragThreshold={7} />);
    fireEvent.pointerDown(own.element(), { button: 0, clientX: 300, clientY: 20 });
    expect(gesture.params!.dragThreshold).toBe(7);
    own.container.remove();

    const fallback = await renderAnchor(() => <EdgeReconnectAnchor type="target" />, 4);
    fireEvent.pointerDown(fallback.element(), { button: 0, clientX: 300, clientY: 20 });
    expect(gesture.params!.dragThreshold).toBe(4);
  });
});
