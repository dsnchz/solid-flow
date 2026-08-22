import { Position } from "@xyflow/system";
import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, InternalNode, Node } from "~/types";

import { createLayoutedEdges, type LayoutedEdgesSource } from "../layoutedEdges";

// Headless core test: the layout join runs entirely without a DOM. Internal
// nodes are fed directly (simulating the adoption + measurement pipeline).

const internalNode = (id: string, x: number, y: number): InternalNode => ({
  id,
  position: { x, y },
  data: {},
  measured: { width: 100, height: 40 },
  internals: {
    positionAbsolute: { x, y },
    z: 0,
    userNode: { id, position: { x, y }, data: {} },
    // strict connectionMode requires measured handle bounds on both ends
    handleBounds: {
      source: [
        {
          id: null,
          type: "source",
          nodeId: id,
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
          type: "target",
          nodeId: id,
          position: Position.Top,
          x: 46,
          y: -4,
          width: 8,
          height: 8,
        },
      ],
    },
  },
});

const makeSource = (edges: Edge[], nodes: InternalNode[]) => {
  const [edgesStore, setEdgesStore] = createStore(edges);
  const nodeLookup = new Map(nodes.map((n) => [n.id, n]));

  const source: LayoutedEdgesSource<Node, Edge> = {
    get edges() {
      return edgesStore;
    },
    connectionMode: "strict",
    defaultEdgeOptions: {},
    elevateEdgesOnSelect: true,
    zIndexMode: "auto",
    onlyRenderVisibleElements: false,
    width: 800,
    height: 600,
    transform: [0, 0, 1],
    nodeLookup,
  };
  return { source, setEdgesStore, nodeLookup };
};

describe("createLayoutedEdges (core, headless)", () => {
  it("joins edges with both endpoints and drops edges with missing nodes", () => {
    const { source } = makeSource(
      [
        { id: "e1", source: "a", target: "b" },
        { id: "ghost", source: "a", target: "missing" },
      ] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    createRoot((dispose) => {
      const layouted = createLayoutedEdges(source);
      flush();
      expect(Object.keys(layouted)).toEqual(["e1"]);
      expect(layouted.e1!.sourceX).toBeTypeOf("number");
      expect(layouted.e1!.edge.id).toBe("e1");
      dispose();
    });
  });

  it("preserves row identity across unrelated edge changes", () => {
    const { source, setEdgesStore } = makeSource(
      [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "a" },
      ] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    createRoot((dispose) => {
      const layouted = createLayoutedEdges(source);
      flush();
      const row1 = layouted.e1;

      setEdgesStore((draft) => {
        draft[1]!.selected = true;
      });
      flush();

      expect(layouted.e1).toBe(row1);
      expect(layouted.e2!.zIndex).toBeGreaterThan(0);
      dispose();
    });
  });

  it("removes rows when their edge leaves the input", () => {
    const { source, setEdgesStore } = makeSource(
      [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "a" },
      ] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    createRoot((dispose) => {
      const layouted = createLayoutedEdges(source);
      flush();
      expect(Object.keys(layouted)).toHaveLength(2);

      setEdgesStore(() => [{ id: "e2", source: "b", target: "a" }] as Edge[]);
      flush();

      expect(Object.keys(layouted)).toEqual(["e2"]);
      dispose();
    });
  });

  it("derives once on creation and once per source change, read or not", () => {
    // Documents the actual laziness semantics on rc.1: the initial derive runs
    // at flush even with no readers, and each source change re-derives on
    // flush. Projections are cheap-but-not-free when unread; creating
    // plugin-scale projections (e.g. minimap) stays gated on mounting the
    // plugin rather than relying on read-laziness.
    let edgesReads = 0;
    const [edgesStore, setEdgesStore] = createStore([
      { id: "e1", source: "a", target: "b" },
    ] as Edge[]);
    const nodeLookup = new Map([
      ["a", internalNode("a", 0, 0)],
      ["b", internalNode("b", 200, 100)],
    ]);
    const source: LayoutedEdgesSource<Node, Edge> = {
      get edges() {
        edgesReads++;
        return edgesStore;
      },
      connectionMode: "strict",
      defaultEdgeOptions: {},
      elevateEdgesOnSelect: false,
      zIndexMode: "auto",
      onlyRenderVisibleElements: false,
      width: 800,
      height: 600,
      transform: [0, 0, 1],
      nodeLookup,
    };

    createRoot((dispose) => {
      const layouted = createLayoutedEdges(source);
      flush();
      expect(edgesReads).toBe(1);

      // memoized: reading does not re-derive
      expect(Object.keys(layouted)).toEqual(["e1"]);
      expect(edgesReads).toBe(1);

      // unread source change still re-derives on flush
      setEdgesStore((draft) => {
        draft.push({ id: "e2", source: "b", target: "a" } as Edge);
      });
      flush();
      expect(edgesReads).toBe(2);
      expect(Object.keys(layouted)).toEqual(["e1", "e2"]);
      dispose();
    });
  });
});
