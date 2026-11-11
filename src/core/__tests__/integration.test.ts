// @vitest-environment node
import { Position } from "@xyflow/system";
import { createEffect, createMemo, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "@/types";

import { RecordMapFacade } from "../facades";
import {
  createInternalNodes,
  type EndpointVersions,
  type NodeMeasurements,
} from "../projections/internalNodes";
import { createResolvedEdges } from "../projections/resolvedEdges";

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: {},
  width: 100,
  height: 40,
});
const hb = (nodeId: string) => ({
  source: [
    {
      id: null,
      type: "source" as const,
      nodeId,
      position: Position.Bottom,
      x: 46,
      y: 36,
      width: 8,
      height: 8,
    },
  ],
  target: [
    {
      id: null,
      type: "target" as const,
      nodeId,
      position: Position.Top,
      x: 46,
      y: -4,
      width: 8,
      height: 8,
    },
  ],
});

describe("integration: resolvedEdges over chained internalNodes sub-stores", () => {
  // Regression (sub-store conversion): SolidFlow's mount-time setConfig fires
  // BOTH defer-reset effects in one flush. With reference-keyed mapArray rows
  // this recreated every row store; the recreated edge stores read the node
  // record mid-swap and stayed subscribed to DISPOSED node row stores — the
  // edge never re-derived and no edge ever rendered. Keying the row stores by
  // id makes resets REUSE the stores (the item accessor swaps instead), so
  // subscriptions can never strand.
  it("edges appear after measurements even when a controlled reset replaced both arrays", () => {
    // Graph construction under the root; writes and reads from mainline
    // (rc.9: a root body is an owned scope, writes there throw in dev).
    const g = createRoot((dispose) => {
      const [nodes, setNodes] = createStore<Node[]>([
        makeNode("a", 0),
        makeNode("b", 200),
        makeNode("c", 400),
        makeNode("d", 600),
      ]);
      const [measurements, setMeasurements] = createStore<NodeMeasurements>({});
      const [edges, setEdges] = createStore<Edge[]>([
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
        { id: "e3", source: "c", target: "d" },
      ]);

      const endpointVersions: EndpointVersions = new Map();
      const internalNodes = createInternalNodes({
        endpointVersions,
        selectionOverlay: {},
        dragOverlay: {},
        get nodes() {
          return nodes;
        },
        get measurements() {
          return measurements;
        },
        nodeOrigin: [0, 0],
        nodeExtent: [
          [-Infinity, -Infinity],
          [Infinity, Infinity],
        ],
        elevateNodesOnSelect: true,
      });
      const nodeLookup = new RecordMapFacade(internalNodes);

      // app shape: initialViewport reads the record BEFORE any flush
      void nodeLookup.get("a")?.internals.positionAbsolute.x;

      const resolved = createResolvedEdges({
        endpointVersion: (id) => endpointVersions.get(id)?.endpoint,
        selectionOverlay: {},
        get edges() {
          return edges;
        },
        connectionMode: "strict",
        defaultEdgeOptions: {},
        elevateEdgesOnSelect: true,
        zIndexMode: undefined,
        nodeLookup,
      });

      // app shape: For subscribes to visibleEdgeIds from the start
      const visibleEdgeIds = createMemo(() => Object.keys(resolved));
      const seenIds: string[][] = [];
      createEffect(
        () => visibleEdgeIds(),
        (ids) => {
          seenIds.push([...ids]);
        },
      );
      // and EdgeWrapper-ish per-leaf subscriber once present
      const sourceXSeen: { value: number | undefined } = { value: undefined };
      createEffect(
        () => resolved.e1?.sourceX,
        (x) => {
          sourceXSeen.value = x;
        },
      );
      return {
        dispose,
        setNodes,
        setEdges,
        setMeasurements,
        internalNodes,
        nodeLookup,
        resolved,
        seenIds,
        sourceXSeen,
      };
    });
    const { dispose, setNodes, setEdges, setMeasurements, internalNodes, nodeLookup, resolved } = g;
    const { seenIds, sourceXSeen } = g;
    {
      flush();
      expect(seenIds).toEqual([[]]);
      expect({ keys: Object.keys(internalNodes.a ?? {}), width: internalNodes.a?.width }).toEqual({
        keys: [
          "id",
          "position",
          "data",
          "width",
          "height",
          "selected",
          "dragging",
          "measured",
          "internals",
        ],
        width: 100,
      });

      // app shape: SolidFlow's mount-time setConfig fires the defer-reset,
      // replacing the nodes array identity -> mapArray recreates every row store
      setNodes(() => [
        makeNode("a", 0),
        makeNode("b", 200),
        makeNode("c", 400),
        makeNode("d", 600),
      ]);
      setEdges(() => [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
        { id: "e3", source: "c", target: "d" },
      ]);
      flush();

      // app shape: the ingest first READS the rows imperatively (doUpdate checks)
      for (const id of ["a", "b", "c", "d"]) {
        const row = nodeLookup.get(id)!;
        void row.measured.width;
        void row.internals.handleBounds;
      }

      // app shape: ingest writes measurements, flushes, then writes measured
      // back into the user store, flushes again
      // one node per flush, mirroring staggered ResizeObserver delivery
      for (const id of ["a", "b", "c", "d"]) {
        setMeasurements((draft) => {
          draft[id] = {
            measured: { width: 100, height: 40 },
            handleSource: hb(id).source,
            handleTarget: hb(id).target,
          };
          return undefined;
        });
        flush();
      }
      setNodes((draft) => {
        for (const n of draft) n.measured = { width: 100, height: 40 };
        return undefined;
      });
      flush();

      expect(Object.keys(resolved).sort()).toEqual(["e1", "e2", "e3"]);
      expect([...(seenIds.at(-1) ?? [])].sort()).toEqual(["e1", "e2", "e3"]);
      expect(sourceXSeen.value).toBeTypeOf("number");
      dispose();
    }
  });
});

describe("integration: an edge row follows its endpoints' versions", () => {
  // The edge row subscribes to each endpoint's version and reads the
  // geometry untracked: every geometry input must bump the version, and
  // nothing else may.
  const setup = (nodes: Node[]) =>
    createRoot((dispose) => {
      const [nodesStore, setNodes] = createStore<Node[]>(nodes);
      const [measurements, setMeasurements] = createStore<NodeMeasurements>({});
      const [edges] = createStore<Edge[]>([{ id: "e1", source: "a", target: "b" }]);
      const endpointVersions: EndpointVersions = new Map();
      const internalNodes = createInternalNodes({
        endpointVersions,
        selectionOverlay: {},
        dragOverlay: {},
        get nodes() {
          return nodesStore;
        },
        get measurements() {
          return measurements;
        },
        nodeOrigin: [0, 0],
        nodeExtent: [
          [-Infinity, -Infinity],
          [Infinity, Infinity],
        ],
        elevateNodesOnSelect: true,
      });
      // The edge row reads the selection sidecar once per run: a counting
      // getter counts the edge's derive runs.
      let edgeRuns = 0;
      const resolved = createResolvedEdges({
        endpointVersion: (id) => endpointVersions.get(id)?.endpoint,
        get selectionOverlay() {
          edgeRuns++;
          return {};
        },
        get edges() {
          return edges;
        },
        connectionMode: "strict",
        defaultEdgeOptions: {},
        elevateEdgesOnSelect: true,
        zIndexMode: undefined,
        nodeLookup: new RecordMapFacade(internalNodes),
      });
      const measure = (id: string, bounds = hb(id)) =>
        setMeasurements((draft) => {
          draft[id] = {
            measured: { width: 100, height: 40 },
            handleSource: bounds.source,
            handleTarget: bounds.target,
          };
          return undefined;
        });
      return { dispose, setNodes, measure, resolved, edgeRuns: () => edgeRuns };
    });

  it("re-lays the edge when an endpoint moves, is measured, or its handles move", () => {
    const { dispose, setNodes, measure, resolved } = setup([makeNode("a", 0), makeNode("b", 200)]);
    flush();
    expect(resolved.e1).toBeUndefined();

    measure("a");
    measure("b");
    flush();
    expect(resolved.e1!.sourceX).toBe(50);

    setNodes((draft) => {
      draft[0]!.position = { x: 30, y: 0 };
      return undefined;
    });
    flush();
    expect(resolved.e1!.sourceX).toBe(80);

    const moved = hb("a");
    moved.source[0]!.x = 76;
    measure("a", moved);
    flush();
    expect(resolved.e1!.sourceX).toBe(110);
    dispose();
  });

  it("re-lays the edge when an unmeasured endpoint's own handles change", () => {
    const withHandles = (id: string, x: number, handleX: number): Node => ({
      ...makeNode(id, x),
      handles: [
        { type: "source", position: Position.Bottom, x: handleX, y: 36, width: 8, height: 8 },
        { type: "target", position: Position.Top, x: handleX, y: -4, width: 8, height: 8 },
      ],
    });
    const { dispose, setNodes, resolved } = setup([
      withHandles("a", 0, 46),
      withHandles("b", 200, 46),
    ]);
    flush();
    expect(resolved.e1!.sourceX).toBe(50);

    setNodes((draft) => {
      draft[0] = withHandles("a", 0, 6);
      return undefined;
    });
    flush();
    expect(resolved.e1!.sourceX).toBe(10);
    dispose();
  });

  it("lays an unmeasured endpoint's own handles out at upstream's default size when they carry none", () => {
    // `handles` without width/height: @xyflow/system sizes them 1x1 by
    // writing into the handle objects, which a store row ignores.
    const withUnsizedHandles = (id: string, x: number): Node => ({
      ...makeNode(id, x),
      handles: [
        { type: "source", position: Position.Bottom, x: 50, y: 40 },
        { type: "target", position: Position.Top, x: 50, y: 0 },
      ],
    });
    const { dispose, resolved } = setup([withUnsizedHandles("a", 0), withUnsizedHandles("b", 200)]);
    flush();
    expect(resolved.e1).toMatchObject({ sourceX: 50.5, sourceY: 41, targetX: 250.5, targetY: 0 });
    dispose();
  });

  it("re-runs no edge row for an endpoint change the edge does not draw from", () => {
    const { dispose, setNodes, measure, resolved, edgeRuns } = setup([
      makeNode("a", 0),
      makeNode("b", 200),
    ]);
    measure("a");
    measure("b");
    flush();
    void resolved.e1;
    const runs = edgeRuns();

    setNodes((draft) => {
      draft[0]!.data = { label: "renamed" };
      return undefined;
    });
    flush();
    expect(edgeRuns()).toBe(runs);
    dispose();
  });
});
