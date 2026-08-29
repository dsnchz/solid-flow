import { render } from "@solidjs/testing-library";
import { fireEvent } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Handle } from "@/components/handle";
import { SolidFlow } from "@/components/SolidFlow";
import { createEdgeStore } from "@/core";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { EdgeConnection, Node, NodeTypes } from "@/types";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

// jsdom has no elementFromPoint; XYHandle uses it to find the handle under the
// cursor while connecting. Individual tests point it at the drop handle.
const documentPrototype = Object.getPrototypeOf(document) as Document;

afterEach(() => {
  delete (documentPrototype as { elementFromPoint?: unknown }).elementFromPoint;
});

// Drags from node `a`'s source handle onto node `b`'s target handle.
const connectByDrag = async (container: HTMLElement) => {
  const sourceHandle = container.querySelector<HTMLElement>(
    '.solid-flow__handle.source[data-nodeid="a"]',
  )!;
  const targetHandle = container.querySelector<HTMLElement>(
    '.solid-flow__handle.target[data-nodeid="b"]',
  )!;
  expect(sourceHandle).not.toBeNull();
  expect(targetHandle).not.toBeNull();

  documentPrototype.elementFromPoint = () => targetHandle;

  fireEvent.pointerDown(sourceHandle, { button: 0, pointerId: 1, clientX: 50, clientY: 40 });
  // two moves: the first exceeds the drag threshold and starts the
  // connection, the second hovers the drop target
  fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
  fireEvent.mouseMove(document, { clientX: 220, clientY: 100 });
  fireEvent.mouseUp(document, { clientX: 220, clientY: 100 });
  await tick();
};

describe("<Handle /> connection gesture", () => {
  it("creates an edge by dragging from a source handle to a target handle (uncontrolled)", async () => {
    // Regression: XYHandle writes the connection state and synchronously reads
    // it back through getFromHandle() in the same task. Solid 2.0 defers reads
    // until flush, so without the flush() in the updateConnection seam the
    // gesture aborted on the first pointermove and no edge was ever created.
    // Uses defaultEdges: on an uncontrolled axis the flow owns membership, so
    // the completed connection lands with no adoption step.
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })]}
        defaultEdges={[]}
        width={800}
        height={600}
      />
    ));
    await tick();
    await connectByDrag(container);

    const renderedEdges = Array.from(container.querySelectorAll(".solid-flow__edge")).map((edge) =>
      edge.getAttribute("data-id"),
    );
    expect(renderedEdges).toEqual(["xy-edge__a-b"]);
  });

  it("controlled: the completed connection is not written into the user's store — onConnect adoption yields exactly one row", async () => {
    // The ownership contract (README "Who owns the data"): a controlled axis'
    // membership belongs to the user's store. The flow must NOT auto-insert
    // the connection, or the documented onConnect adoption duplicates the id.
    const [edges, setEdges] = createEdgeStore([]);
    const onConnect = (connection: EdgeConnection) => {
      setEdges((draft) => {
        draft.push(connection);
      });
    };
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })]}
        edges={edges}
        onConnect={onConnect}
        width={800}
        height={600}
      />
    ));
    await tick();
    await connectByDrag(container);

    expect(edges.map((edge) => edge.id)).toEqual(["xy-edge__a-b"]);
    expect(container.querySelectorAll('.solid-flow__edge[data-id="xy-edge__a-b"]')).toHaveLength(1);
  });

  it("controlled without adoption: the completed connection does not enter the flow", async () => {
    const [edges] = createEdgeStore([]);
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })]}
        edges={edges}
        width={800}
        height={600}
      />
    ));
    await tick();
    await connectByDrag(container);

    expect(edges).toHaveLength(0);
    expect(container.querySelectorAll(".solid-flow__edge")).toHaveLength(0);
  });

  it("does not create an edge when the drag ends on empty pane", async () => {
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })]}
        edges={[]}
        width={800}
        height={600}
      />
    ));
    await tick();

    const sourceHandle = container.querySelector<HTMLElement>(
      '.solid-flow__handle.source[data-nodeid="a"]',
    )!;

    documentPrototype.elementFromPoint = () => null;

    fireEvent.pointerDown(sourceHandle, { button: 0, pointerId: 1, clientX: 50, clientY: 40 });
    fireEvent.mouseMove(document, { clientX: 400, clientY: 400 });
    fireEvent.mouseUp(document, { clientX: 400, clientY: 400 });
    await tick();

    expect(container.querySelectorAll(".solid-flow__edge")).toHaveLength(0);
  });

  it("fires onConnect and onDisconnect callbacks as connections change", async () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    let flow!: ReturnType<typeof useSolidFlow>;

    const nodeTypes: NodeTypes = {
      custom: () => (
        <div style={{ width: "100px", height: "40px" }}>
          <Handle
            type="source"
            position="bottom"
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>
      ),
    };

    const Probe = () => {
      flow = useSolidFlow();
      return null;
    };

    render(() => (
      <SolidFlow
        nodes={[
          makeNode({ id: "a", type: "custom" }),
          makeNode({ id: "b", position: { x: 200, y: 100 } }),
        ]}
        edges={[]}
        nodeTypes={nodeTypes}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();
    expect(onConnect).not.toHaveBeenCalled();

    flow.addEdges({ id: "e1", source: "a", target: "b" });
    await tick();
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect.mock.lastCall![0]).toEqual([
      expect.objectContaining({ source: "a", target: "b" }),
    ]);
    expect(onDisconnect).not.toHaveBeenCalled();

    await flow.deleteElements({ edges: [{ id: "e1" }] });
    await tick();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect.mock.lastCall![0]).toEqual([
      expect.objectContaining({ source: "a", target: "b" }),
    ]);
  });

  it("fires callbacks for partial changes on a handle with multiple connections", async () => {
    // Regression: the connection lookup mutated its per-key maps in place, so
    // ReactiveMap.set never saw a value-identity change — a second edge on the
    // same handle (and any partial removal) was invisible to subscribers.
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    let flow!: ReturnType<typeof useSolidFlow>;

    const nodeTypes: NodeTypes = {
      custom: () => (
        <div style={{ width: "100px", height: "40px" }}>
          <Handle
            type="source"
            position="bottom"
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>
      ),
    };

    const Probe = () => {
      flow = useSolidFlow();
      return null;
    };

    render(() => (
      <SolidFlow
        nodes={[
          makeNode({ id: "a", type: "custom" }),
          makeNode({ id: "b", position: { x: 200, y: 100 } }),
          makeNode({ id: "c", position: { x: 400, y: 200 } }),
        ]}
        edges={[]}
        nodeTypes={nodeTypes}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();

    flow.addEdges({ id: "e1", source: "a", target: "b" });
    await tick();
    flow.addEdges({ id: "e2", source: "a", target: "c" });
    await tick();

    expect(onConnect).toHaveBeenCalledTimes(2);
    expect(onConnect.mock.lastCall![0]).toEqual([
      expect.objectContaining({ source: "a", target: "c" }),
    ]);

    await flow.deleteElements({ edges: [{ id: "e1" }] });
    await tick();

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect.mock.lastCall![0]).toEqual([
      expect.objectContaining({ source: "a", target: "b" }),
    ]);
  });
});
