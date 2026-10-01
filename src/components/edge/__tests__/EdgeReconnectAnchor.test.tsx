import { fireEvent, render } from "@solidjs/testing-library";
import type { Connection, XYHandle } from "@xyflow/system";
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
