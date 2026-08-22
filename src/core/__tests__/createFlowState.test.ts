// @vitest-environment node
import type { PanZoomInstance } from "@xyflow/system";
import { createRoot, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import type { Edge, Node } from "~/types";

import { createFlowState } from "../createFlowState";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: {},
  width: 100,
  height: 40,
  ...overrides,
});

const makeEdge = (overrides: Partial<Edge> & { id: string; source: string; target: string }) =>
  ({ ...overrides }) as Edge;

// Headless harness (node environment — no DOM, no injections): keeps the
// root alive until the (possibly async) run callback settles. Writes happen
// outside the root's owned scope.
const withFlow = async <T>(
  props: Parameters<typeof createFlowState>[0],
  run: (flow: ReturnType<typeof createFlowState>) => T | Promise<T>,
): Promise<T> => {
  let bundle!: ReturnType<typeof createFlowState>;
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    bundle = createFlowState(props);
  });
  try {
    flush();
    return await run(bundle);
  } finally {
    dispose();
  }
};

describe("FlowState struct", () => {
  it("mirrors the graph reactively through stable destructured identities", async () => {
    await withFlow({ nodes: [makeNode({ id: "a" })], edges: [] }, ({ flow, commands }) => {
      // destructuring is safe: identities are stable, reactivity is in the reads
      expect(flow.nodes.map((n) => n.id)).toEqual(["a"]);

      commands.addNodes(makeNode({ id: "b", position: { x: 50, y: 50 } }));
      flush();

      expect(flow.nodes.map((n) => n.id)).toEqual(["a", "b"]);
      expect(flow.internalNodes.b?.internals.positionAbsolute).toEqual({ x: 50, y: 50 });
    });
  });

  it("exposes selection as one reactive object with stable identity", async () => {
    await withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ flow, actions }) => {
        const selection = flow.selection;
        expect(selection.nodes).toHaveLength(0);
        expect(selection.edges).toHaveLength(0);

        // multi-selection keeps nodes and edges selected together (single-
        // selection mode intentionally clears the other kind, upstream parity)
        actions.setMultiselectionKeyPressed(true);
        flush();
        actions.addSelectedNodes(["b"]);
        actions.addSelectedEdges(["e1"]);
        flush();

        expect(flow.selection).toBe(selection);
        expect(selection.nodes.map((n) => n.id)).toEqual(["b"]);
        expect(selection.edges.map((e) => e.id)).toEqual(["e1"]);
      },
    );
  });

  it("reflects viewport, initialization, and config fields", async () => {
    await withFlow(
      { nodes: [makeNode({ id: "a" })], edges: [], minZoom: 0.25, maxZoom: 3 },
      ({ flow, actions }) => {
        expect(flow.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
        expect(flow.minZoom).toBe(0.25);
        expect(flow.maxZoom).toBe(3);
        expect(flow.colorMode).toBe("light");
        expect(flow.dragging).toBe(false);
        expect(flow.viewportInitialized).toBe(false);
        expect(flow.nodesInitialized).toBe(false);

        actions.setViewport({ x: 10, y: 20, zoom: 2 });
        actions.setDragging(true);
        flush();

        expect(flow.viewport).toEqual({ x: 10, y: 20, zoom: 2 });
        expect(flow.dragging).toBe(true);
      },
    );
  });
});

describe("FlowCommands", () => {
  it("updateNode merges by default and replaces on request", async () => {
    await withFlow(
      { nodes: [makeNode({ id: "a", data: { label: "one" } })], edges: [] },
      ({ flow, commands }) => {
        commands.updateNode("a", { selected: true });
        flush();
        expect(flow.nodes[0]).toMatchObject({ id: "a", selected: true, data: { label: "one" } });

        commands.updateNode("a", (node) => ({ position: { x: node.position.x + 5, y: 0 } }));
        flush();
        expect(flow.nodes[0]!.position).toEqual({ x: 5, y: 0 });

        commands.updateNode("a", makeNode({ id: "a", data: { label: "fresh" } }), {
          replace: true,
        });
        flush();
        expect(flow.nodes[0]!.selected).toBeUndefined();
        expect(flow.nodes[0]!.data).toEqual({ label: "fresh" });
      },
    );
  });

  it("updateNodeData merges and replaces node data", async () => {
    await withFlow(
      { nodes: [makeNode({ id: "a", data: { label: "one", keep: true } })], edges: [] },
      ({ flow, commands }) => {
        commands.updateNodeData("a", { label: "two" });
        flush();
        expect(flow.nodes[0]!.data).toEqual({ label: "two", keep: true });

        commands.updateNodeData("a", { label: "three" }, { replace: true });
        flush();
        expect(flow.nodes[0]!.data).toEqual({ label: "three" });
      },
    );
  });

  it("updateEdge merges edge props", async () => {
    await withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ flow, commands }) => {
        commands.updateEdge("e1", { animated: true });
        flush();
        expect(flow.edges[0]).toMatchObject({ id: "e1", animated: true });
      },
    );
  });

  it("setNodes exposes the canonical draft setter", async () => {
    await withFlow({ nodes: [makeNode({ id: "a" })], edges: [] }, ({ flow, commands }) => {
      commands.setNodes((draft) => {
        draft[0]!.position = { x: 7, y: 9 };
        return undefined;
      });
      flush();
      expect(flow.internalNodes.a?.internals.positionAbsolute).toEqual({ x: 7, y: 9 });
    });
  });

  it("deleteElements cascades to connected edges and fires delete callbacks", async () => {
    const onNodesDelete = vi.fn();
    const onEdgesDelete = vi.fn();
    await withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" }), makeNode({ id: "c" })],
        edges: [
          makeEdge({ id: "e1", source: "a", target: "b" }),
          makeEdge({ id: "e2", source: "b", target: "c" }),
        ],
        onNodesDelete,
        onEdgesDelete,
      },
      async ({ flow, commands }) => {
        const { deletedNodes, deletedEdges } = await commands.deleteElements({
          nodes: [{ id: "a" }],
        });
        flush();

        expect(deletedNodes.map((n) => n.id)).toEqual(["a"]);
        expect(deletedEdges.map((e) => e.id)).toEqual(["e1"]);
        expect(flow.nodes.map((n) => n.id)).toEqual(["b", "c"]);
        expect(flow.edges.map((e) => e.id)).toEqual(["e2"]);
        expect(onNodesDelete).toHaveBeenCalledTimes(1);
        expect(onEdgesDelete).toHaveBeenCalledTimes(1);
        expect(flow.internalNodes.a).toBeUndefined();
        expect(flow.layoutedEdges.e1).toBeUndefined();
      },
    );
  });

  it("deleteElements honors an onBeforeDelete veto", async () => {
    await withFlow(
      {
        nodes: [makeNode({ id: "a" })],
        edges: [],
        onBeforeDelete: async () => false,
      },
      async ({ flow, commands }) => {
        const { deletedNodes } = await commands.deleteElements({ nodes: [{ id: "a" }] });
        flush();
        expect(deletedNodes).toHaveLength(0);
        expect(flow.nodes).toHaveLength(1);
      },
    );
  });

  it("toObject returns a detached plain clone", async () => {
    await withFlow(
      {
        nodes: [makeNode({ id: "a", data: { label: "x" } })],
        edges: [],
      },
      ({ flow, commands }) => {
        const snapshot = commands.toObject();
        expect(snapshot.nodes[0]).toMatchObject({ id: "a", data: { label: "x" } });
        expect(snapshot.viewport).toEqual({ x: 0, y: 0, zoom: 1 });

        snapshot.nodes[0]!.data = { label: "mutated" };
        expect(flow.nodes[0]!.data).toEqual({ label: "x" });
      },
    );
  });

  it("computes node bounds and intersections from declared dimensions", async () => {
    await withFlow(
      {
        nodes: [
          makeNode({ id: "a", position: { x: 0, y: 0 } }),
          makeNode({ id: "b", position: { x: 50, y: 0 } }),
          makeNode({ id: "far", position: { x: 500, y: 500 } }),
        ],
        edges: [],
      },
      ({ commands }) => {
        expect(commands.getNodesBounds(["a", "b"])).toEqual({
          x: 0,
          y: 0,
          width: 150,
          height: 40,
        });

        const hits = commands.getIntersectingNodes({ id: "a" });
        expect(hits.map((n) => n.id)).toEqual(["b"]);

        expect(
          commands.isNodeIntersecting({ id: "far" }, { x: 0, y: 0, width: 200, height: 200 }),
        ).toBe(false);
        expect(
          commands.isNodeIntersecting({ id: "b" }, { x: 0, y: 0, width: 200, height: 200 }),
        ).toBe(true);
      },
    );
  });

  it("viewport commands drive the panZoom instance and fail soft without one", async () => {
    await withFlow({ nodes: [], edges: [] }, async ({ commands, actions }) => {
      expect(await commands.setViewport({ x: 1, y: 2, zoom: 1 })).toBe(false);
      expect(await commands.setZoom(2)).toBe(false);
      expect(await commands.fitBounds({ x: 0, y: 0, width: 100, height: 100 })).toBe(false);

      const setViewport = vi.fn(async () => undefined);
      const scaleTo = vi.fn(async () => true);
      actions.setPanZoom({
        setViewport,
        scaleTo,
        syncViewport: vi.fn(),
        setScaleExtent: vi.fn(),
        setTranslateExtent: vi.fn(),
      } as unknown as PanZoomInstance);
      flush();

      expect(await commands.setViewport({ x: 1, y: 2, zoom: 3 })).toBe(true);
      expect(setViewport).toHaveBeenCalledWith({ x: 1, y: 2, zoom: 3 }, undefined);
      expect(await commands.setZoom(2)).toBe(true);
      expect(scaleTo).toHaveBeenCalledWith(2, { duration: undefined });
      expect(await commands.fitBounds({ x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    });
  });

  it("position conversions pass through without a mounted DOM node", async () => {
    await withFlow({ nodes: [], edges: [] }, ({ commands }) => {
      expect(commands.screenToFlowPosition({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
      expect(commands.flowToScreenPosition({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
      // no DOM: requesting a re-measure is a safe no-op
      expect(() => commands.updateNodeInternals(["a"])).not.toThrow();
    });
  });
});
