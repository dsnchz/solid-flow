// @vitest-environment node
import { initialConnection } from "@xyflow/system";
import { createMemo, createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "@/types";

import { createFlowReadSurface, type FlowReadSource } from "../flowReadSurface";

// The public read surface: `flow` forwards the store's reactive reads, and
// it and `flow.selection` are stable identities, so consumers can
// destructure them.

const setup = () => {
  const [nodes, setNodes] = createSignal<Node[]>([]);
  const [selectedNodes, setSelectedNodes] = createSignal<Node[]>([]);
  const source: FlowReadSource = {
    get nodes() {
      return nodes();
    },
    edges: [],
    get selectedNodes() {
      return selectedNodes();
    },
    selectedEdges: [],
    nodesInitialized: true,
    viewportInitialized: false,
    viewport: { x: 1, y: 2, zoom: 3 },
    width: 800,
    height: 600,
    connection: initialConnection,
    dragging: false,
    minZoom: 0.5,
    maxZoom: 2,
    nodesDraggable: true,
    nodesConnectable: false,
    elementsSelectable: true,
    snapGrid: undefined,
  };
  const internalNodes = {};
  const connections = {};
  const flow = createFlowReadSurface<Node, Edge>(source, internalNodes, connections);
  return { flow, internalNodes, connections, setNodes, setSelectedNodes };
};

describe("createFlowReadSurface", () => {
  it("forwards every read to the store", () => {
    const { flow, internalNodes, connections } = setup();
    expect(flow.internalNodes).toBe(internalNodes);
    expect(flow.connections).toBe(connections);
    expect(flow.viewport).toEqual({ x: 1, y: 2, zoom: 3 });
    expect([flow.width, flow.height, flow.minZoom, flow.maxZoom]).toEqual([800, 600, 0.5, 2]);
    expect([flow.nodesInitialized, flow.viewportInitialized, flow.dragging]).toEqual([
      true,
      false,
      false,
    ]);
    expect([flow.nodesDraggable, flow.nodesConnectable, flow.elementsSelectable]).toEqual([
      true,
      false,
      true,
    ]);
    expect(flow.connection).toBe(initialConnection);
    expect(flow.snapGrid).toBeUndefined();
  });

  it("is a live subscription, with a stable selection object", () => {
    const { flow, setNodes, setSelectedNodes } = setup();
    const selection = flow.selection;
    let dispose!: () => void;
    const seen: number[] = [];
    createRoot((d) => {
      dispose = d;
      createMemo(() => void seen.push(flow.nodes.length + flow.selection.nodes.length * 10));
    });
    flush();

    const a: Node = { id: "a", position: { x: 0, y: 0 }, data: {} };
    setNodes([a]);
    flush();
    setSelectedNodes([a]);
    flush();
    expect(seen).toEqual([0, 1, 11]);
    expect(flow.selection).toBe(selection);
    dispose();
  });
});
