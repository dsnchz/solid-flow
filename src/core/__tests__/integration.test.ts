// @vitest-environment node
import { Position } from "@xyflow/system";
import { createEffect, createMemo, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "@/types";

import { RecordMapFacade } from "../facades";
import { createInternalNodes, type NodeMeasurements } from "../projections/internalNodes";
import { createLayoutedEdges } from "../projections/layoutedEdges";

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

describe("integration: layoutedEdges over chained internalNodes sub-stores", () => {
  // Regression (sub-store conversion): SolidFlow's mount-time setConfig fires
  // BOTH defer-reset effects in one flush. With reference-keyed mapArray rows
  // this recreated every row store; the recreated edge stores read the node
  // record mid-swap and stayed subscribed to DISPOSED node row stores — the
  // edge never re-derived and no edge ever rendered. Keying the row stores by
  // id makes resets REUSE the stores (the item accessor swaps instead), so
  // subscriptions can never strand.
  it("edges appear after measurements even when a controlled reset replaced both arrays", () => {
    createRoot((dispose) => {
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

      const internalNodes = createInternalNodes({
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

      const layouted = createLayoutedEdges({
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
      const visibleEdgeIds = createMemo(() => Object.keys(layouted));
      const seenIds: string[][] = [];
      createEffect(
        () => visibleEdgeIds(),
        (ids) => {
          seenIds.push([...ids]);
        },
      );
      // and EdgeWrapper-ish per-leaf subscriber once present
      let sourceXSeen: number | undefined;
      createEffect(
        () => layouted.e1?.sourceX,
        (x) => {
          sourceXSeen = x;
        },
      );
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
          draft[id] = { measured: { width: 100, height: 40 }, handleBounds: hb(id) };
          return undefined;
        });
        flush();
      }
      setNodes((draft) => {
        for (const n of draft) n.measured = { width: 100, height: 40 };
        return undefined;
      });
      flush();

      expect(Object.keys(layouted).sort()).toEqual(["e1", "e2", "e3"]);
      expect([...(seenIds.at(-1) ?? [])].sort()).toEqual(["e1", "e2", "e3"]);
      expect(sourceXSeen).toBeTypeOf("number");
      dispose();
    });
  });
});
