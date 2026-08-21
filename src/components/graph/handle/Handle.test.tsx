import { render } from "@solidjs/testing-library";
import { fireEvent } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { SolidFlow } from "~/components/SolidFlow";
import type { Edge, Node } from "~/types";

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

describe("<Handle /> connection gesture", () => {
  it("creates an edge by dragging from a source handle to a target handle", async () => {
    // Regression: XYHandle writes the connection state and synchronously reads
    // it back through getFromHandle() in the same task. Solid 2.0 defers reads
    // until flush, so without the flush() in the updateConnection seam the
    // gesture aborted on the first pointermove and no edge was ever created.
    const edges: Edge[] = [];
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })]}
        edges={edges}
        width={800}
        height={600}
      />
    ));
    await tick();

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

    const renderedEdges = Array.from(container.querySelectorAll(".solid-flow__edge")).map((edge) =>
      edge.getAttribute("data-id"),
    );
    expect(renderedEdges).toEqual(["xy-edge__a-b"]);
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
});
