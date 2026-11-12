// @vitest-environment node
import { infiniteExtent, Position, type Rect } from "@xyflow/system";
import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, InternalNode, Node } from "@/types";

import { createGeometryFeed } from "../geometryFeed";
import { createEdgeBoxes } from "../projections/edgeBoxes";
import {
  createInternalNodes,
  type EndpointVersions,
  type NodeGeometry,
  type NodeMeasurements,
} from "../projections/internalNodes";
import { createResolvedEdges, type EdgeEndpoints } from "../projections/resolvedEdges";

// Cold / hot rows (#22): with `lazyRows` a row is created on its first read;
// until then a small memo reports what culling needs (the rect, the cull
// pin, an edge's endpoints) and nothing else derives. Graphs are built under
// a root; writes and reads run from mainline.

const handles: Node["handles"] = [
  { type: "target", position: Position.Top, x: 46, y: -4, width: 8, height: 8 },
  { type: "source", position: Position.Bottom, x: 46, y: 36, width: 8, height: 8 },
];

const setupNodes = (initial: Node[]) =>
  createRoot((dispose) => {
    const [nodes, setNodes] = createStore<Node[]>(initial);
    const [measurements] = createStore<NodeMeasurements>({});
    const rects = new Map<string, NodeGeometry>();
    const pins = new Map<string, boolean>();
    const counts = { reports: 0 };
    const endpointVersions: EndpointVersions = new Map();
    const internalNodes = createInternalNodes({
      selectionOverlay: {},
      dragOverlay: {},
      get nodes() {
        return nodes;
      },
      get measurements() {
        return measurements;
      },
      nodeOrigin: [0.5, 0.5],
      nodeExtent: infiniteExtent,
      elevateNodesOnSelect: true,
      lazyRows: true,
      endpointVersions,
      onGeometryChange: (id, rect) => {
        counts.reports++;
        if (rect) rects.set(id, rect);
        else rects.delete(id);
      },
      reportCullPin: (id, pinned) => pins.set(id, pinned),
    });
    return { dispose, internalNodes, setNodes, rects, pins, endpointVersions, counts };
  });

describe("cold node rows (lazyRows)", () => {
  it("reports the rect and pin a row would, creates no row until read, and agrees once hot", () => {
    const { dispose, internalNodes, setNodes, rects, pins, endpointVersions, counts } = setupNodes([
      {
        id: "a",
        position: { x: 100, y: 100 },
        data: {},
        measured: { width: 100, height: 40 },
        extent: [
          [0, 0],
          [1000, 120],
        ],
        handles,
      },
      { id: "b", position: { x: 0, y: 0 }, data: {}, selected: true },
    ]);
    flush();
    expect(endpointVersions.size).toBe(0);
    // origin [0.5, 0.5], then the extent clamps y: 100 - 20 = 80 -> 120 - 40
    expect(rects.get("a")).toEqual({ x: 50, y: 80, width: 100, height: 40 });
    expect(pins.get("a")).toBe(false);
    expect(pins.get("b")).toBe(true); // selected (and unmeasured)

    // a key the row did not have re-runs the cold row (it reads present keys only)
    setNodes((draft) => {
      draft[0]!.cullable = false;
    });
    flush();
    expect(pins.get("a")).toBe(true);
    setNodes((draft) => {
      draft[0]!.cullable = true;
    });
    flush();
    expect(pins.get("a")).toBe(false);

    setNodes((draft) => {
      draft[0]!.position = { x: 300, y: 0 };
    });
    flush();
    expect(rects.get("a")).toEqual({ x: 250, y: 0, width: 100, height: 40 });
    expect(endpointVersions.size).toBe(0);

    const before = counts.reports;
    const row = internalNodes.a!;
    flush();
    expect(endpointVersions.has("a")).toBe(true);
    expect(endpointVersions.has("b")).toBe(false);
    expect({ ...row.internals.positionAbsolute }).toEqual({ x: 250, y: 0 });
    // the hot row's first report matches the cold one: nothing re-reported
    expect(counts.reports).toBe(before);

    setNodes((draft) => {
      draft[0]!.position = { x: 400, y: 0 };
    });
    flush();
    expect(rects.get("a")).toEqual({ x: 350, y: 0, width: 100, height: 40 });
    expect({ ...internalNodes.a!.internals.positionAbsolute }).toEqual({ x: 350, y: 0 });
    dispose();
  });

  it("keeps every id in the record, and creates a cold row that gains a parent", () => {
    const { dispose, internalNodes, setNodes, endpointVersions } = setupNodes([
      { id: "p", position: { x: 0, y: 0 }, data: {}, measured: { width: 200, height: 200 } },
      { id: "c", position: { x: 10, y: 10 }, data: {}, measured: { width: 20, height: 20 } },
    ]);
    flush();
    expect(Object.keys(internalNodes)).toEqual(["p", "c"]);
    expect(endpointVersions.size).toBe(0);

    setNodes((draft) => {
      draft[1]!.parentId = "p";
    });
    flush();
    // subflows are hot: the child, and the parent it links to
    expect([...endpointVersions.keys()].sort()).toEqual(["c", "p"]);
    expect({ ...internalNodes.c!.internals.positionAbsolute }).toEqual({ x: -100, y: -100 });
    dispose();
  });
});

const internalNode = (id: string, x: number, y: number): InternalNode => ({
  id,
  position: { x, y },
  data: {},
  measured: { width: 100, height: 40 },
  handles,
  internals: { positionAbsolute: { x, y }, z: 0, userNode: { id, position: { x, y }, data: {} } },
});

describe("cold edge rows (lazyRows)", () => {
  it("reports endpoints and pins without reading the endpoint nodes until the row is read", () => {
    const nodes = new Map([
      ["a", internalNode("a", 0, 0)],
      ["b", internalNode("b", 300, 0)],
    ]);
    const counts = { nodeReads: 0 };
    const endpoints = new Map<string, EdgeEndpoints>();
    const pins = new Map<string, boolean>();
    const { dispose, resolved, setEdges } = createRoot((dispose) => {
      const [edges, setEdges] = createStore<Edge[]>([
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "a", selected: true },
      ]);
      const resolved = createResolvedEdges<Node, Edge>({
        selectionOverlay: {},
        get edges() {
          return edges;
        },
        connectionMode: "loose",
        defaultEdgeOptions: {},
        elevateEdgesOnSelect: true,
        nodeLookup: {
          get: (id) => {
            counts.nodeReads++;
            return nodes.get(id);
          },
          size: nodes.size,
        },
        endpointVersion: () => 0,
        lazyRows: true,
        reportEndpoints: (id, ends) => {
          if (ends) endpoints.set(id, ends);
          else endpoints.delete(id);
        },
        reportCullPin: (id, pinned) => pins.set(id, pinned),
      });
      return { dispose, resolved, setEdges };
    });
    flush();
    expect(counts.nodeReads).toBe(0);
    expect(endpoints.get("e1")).toEqual({ source: "a", target: "b" });
    expect(pins.get("e1")).toBe(false);
    expect(pins.get("e2")).toBe(true);

    setEdges((draft) => {
      draft[0]!.target = "a";
    });
    flush();
    expect(endpoints.get("e1")).toEqual({ source: "a", target: "a" });
    expect(counts.nodeReads).toBe(0);

    expect(resolved.e1?.source).toBe("a");
    expect(counts.nodeReads).toBe(2);
    dispose();
  });
});

describe("createEdgeBoxes", () => {
  it("boxes the endpoints' node rects and re-boxes only an edge whose node or endpoints changed", () => {
    const { dispose, nodes, endpoints, boxes, drain } = createRoot((dispose) => {
      const nodes = createGeometryFeed<Rect>();
      const endpoints = createGeometryFeed<EdgeEndpoints>();
      const boxes = createGeometryFeed<Rect>();
      const drain = boxes.createDrain();
      createEdgeBoxes({ nodes, endpoints }, boxes);
      return { dispose, nodes, endpoints, boxes, drain };
    });
    nodes.report("a", { x: 0, y: 0, width: 100, height: 40 });
    nodes.report("b", { x: 300, y: 200, width: 100, height: 40 });
    nodes.report("c", { x: 900, y: 0, width: 10, height: 10 });
    endpoints.report("ab", { source: "a", target: "b" });
    endpoints.report("bc", { source: "b", target: "c" });
    endpoints.report("ax", { source: "a", target: "missing" });
    flush();
    expect(boxes.map.get("ab")).toEqual({ x: 0, y: 0, width: 400, height: 240 });
    expect(boxes.map.get("bc")).toEqual({ x: 300, y: 0, width: 610, height: 240 });
    expect(boxes.map.has("ax")).toBe(false);
    drain();

    nodes.report("c", { x: 1000, y: 0, width: 10, height: 10 });
    flush();
    expect([...drain()]).toEqual(["bc"]);
    expect(boxes.map.get("bc")).toEqual({ x: 300, y: 0, width: 710, height: 240 });

    endpoints.report("ab", { source: "a", target: "c" });
    endpoints.report("bc", null);
    flush();
    expect(boxes.map.get("ab")).toEqual({ x: 0, y: 0, width: 1010, height: 40 });
    expect(boxes.map.has("bc")).toBe(false);
    // b no longer anchors any edge: moving it re-boxes nothing
    drain();
    nodes.report("b", { x: 0, y: 0, width: 1, height: 1 });
    flush();
    expect([...drain()]).toEqual([]);
    dispose();
  });
});
