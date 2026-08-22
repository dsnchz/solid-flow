import type { PanZoomInstance } from "@xyflow/system";
import { createRoot, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import type { Edge, Node } from "~/types";

import { createSolidFlow } from "../createSolidFlow";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: {},
  ...overrides,
});

const makeEdge = (overrides: Partial<Edge> & { id: string; source: string; target: string }) =>
  ({ ...overrides }) as Edge;

// The callback runs OUTSIDE the root's owned scope: signal writes (setConfig,
// setPanZoom, ...) throw REACTIVE_WRITE_IN_OWNED_SCOPE when performed inside it.
const withFlow = <T>(
  props: Parameters<typeof createSolidFlow>[0],
  run: (flow: ReturnType<typeof createSolidFlow>) => T,
): T => {
  let flow!: ReturnType<typeof createSolidFlow>;
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    flow = createSolidFlow(props);
  });
  try {
    flush();
    return run(flow);
  } finally {
    dispose();
  }
};

describe("createSolidFlow", () => {
  it("exposes the provided nodes and edges", () => {
    withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 50, y: 50 } })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ store }) => {
        expect(store.nodes.map((n) => n.id)).toEqual(["a", "b"]);
        expect((store.edges as Edge[]).map((e) => e.id)).toEqual(["e1"]);
      },
    );
  });

  it("populates the node lookup with internal nodes", () => {
    withFlow(
      { nodes: [makeNode({ id: "a", position: { x: 10, y: 20 } })], edges: [] },
      ({ nodeLookup }) => {
        expect(nodeLookup.get("a")?.internals.positionAbsolute).toEqual({ x: 10, y: 20 });
      },
    );
  });

  it("populates edge and connection lookups", () => {
    withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ edgeLookup, connections }) => {
        expect(edgeLookup.e1?.id).toBe("e1");
        expect(Object.keys(connections.a ?? {})).toHaveLength(1);
        expect(Object.keys(connections.b ?? {})).toHaveLength(1);
      },
    );
  });

  it("tracks selected nodes and edges reactively", () => {
    withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ store, actions }) => {
        expect(store.selectedNodes).toHaveLength(0);

        actions.setNodes((nodes) => {
          for (const node of nodes) {
            if (node.id === "b") node.selected = true;
          }
          return undefined;
        });
        actions.setEdges((edges) => {
          for (const edge of edges) {
            edge.selected = true;
          }
          return undefined;
        });
        flush();

        expect(store.selectedNodes.map((n) => n.id)).toEqual(["b"]);
        expect(store.selectedEdges.map((e) => e.id)).toEqual(["e1"]);
      },
    );
  });

  it("reports nodesInitialized only when all non-hidden nodes are measured", () => {
    withFlow({ nodes: [makeNode({ id: "a" })], edges: [] }, ({ store, actions }) => {
      expect(store.nodesInitialized).toBe(false);

      actions.setNodes((nodes) => {
        for (const node of nodes) {
          node.measured = { width: 100, height: 40 };
        }
        return undefined;
      });
      flush();

      expect(store.nodesInitialized).toBe(true);
    });
  });

  it("ignores hidden nodes for nodesInitialized", () => {
    withFlow(
      {
        nodes: [
          makeNode({ id: "a", measured: { width: 100, height: 40 } }),
          makeNode({ id: "ghost", hidden: true }),
        ],
        edges: [],
      },
      ({ store }) => {
        expect(store.nodesInitialized).toBe(true);
      },
    );
  });

  it("is not initialized for an empty graph", () => {
    withFlow({ nodes: [], edges: [] }, ({ store }) => {
      expect(store.nodesInitialized).toBe(false);
      expect(store.viewportInitialized).toBe(false);
    });
  });

  it("elevates selected node z by default but not in manual zIndexMode", () => {
    const select = (actions: ReturnType<typeof createSolidFlow>["actions"]) => {
      actions.setNodes((nodes) => {
        for (const node of nodes) {
          node.selected = true;
        }
        return undefined;
      });
      flush();
    };

    withFlow({ nodes: [makeNode({ id: "a" })], edges: [] }, ({ nodeLookup, actions }) => {
      select(actions);
      expect(nodeLookup.get("a")?.internals.z).toBe(1000);
    });

    withFlow(
      { nodes: [makeNode({ id: "a" })], edges: [], zIndexMode: "manual" },
      ({ nodeLookup, actions }) => {
        select(actions);
        expect(nodeLookup.get("a")?.internals.z).toBe(0);
      },
    );
  });

  it("adds edges through the addEdge action", () => {
    withFlow(
      { nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })], edges: [] },
      ({ store, actions }) => {
        actions.addEdge({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
        flush();
        expect(store.edges).toHaveLength(1);
        expect(store.edges[0]).toMatchObject({ source: "a", target: "b" });
      },
    );
  });

  it("addEdge rejects duplicate connections", () => {
    withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ store, actions }) => {
        actions.addEdge({ source: "a", target: "b", sourceHandle: null, targetHandle: null });
        flush();
        expect(store.edges).toHaveLength(1);
        expect(store.edges[0]!.id).toBe("e1");
      },
    );
  });

  it("addEdge preserves the identity of existing edge rows", () => {
    // Regression: the projection form of createStore rewrapped every element
    // on structural writes, churning row identities and collapsing the
    // mapArray edge pipeline. Element identity must survive a push.
    withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ store, actions, edgeLookup }) => {
        const existing = store.edges[0];
        actions.addEdge({ source: "b", target: "a", sourceHandle: null, targetHandle: null });
        flush();
        expect(store.edges).toHaveLength(2);
        expect(store.edges[0]).toBe(existing);
        expect(edgeLookup.e1).toBeDefined();
        expect(edgeLookup["xy-edge__b-a"]).toBeDefined();
      },
    );
  });

  it("resets local drafts when the nodes input identity changes", () => {
    withFlow(
      { nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })], edges: [] },
      ({ store, actions, nodeLookup }) => {
        actions.setNodes((nodes) => {
          for (const node of nodes) node.selected = true;
          return undefined;
        });
        flush();
        expect(store.selectedNodes).toHaveLength(2);

        actions.setConfig((prev) => ({
          ...prev,
          nodes: [makeNode({ id: "a" }), makeNode({ id: "c" })],
        }));
        flush();

        expect(store.nodes.map((n) => n.id)).toEqual(["a", "c"]);
        expect(store.selectedNodes).toHaveLength(0);
        // stale lookup entries are garbage-collected, new ones adopted
        expect(nodeLookup.has("b")).toBe(false);
        expect(nodeLookup.has("c")).toBe(true);
      },
    );
  });

  it("resets edges and cleans lookups when the edges input identity changes", () => {
    withFlow(
      {
        nodes: [makeNode({ id: "a" }), makeNode({ id: "b" }), makeNode({ id: "c" })],
        edges: [makeEdge({ id: "e1", source: "a", target: "b" })],
      },
      ({ store, actions, edgeLookup }) => {
        actions.addEdge({ source: "b", target: "c", sourceHandle: null, targetHandle: null });
        flush();
        expect(store.edges).toHaveLength(2);

        actions.setConfig((prev) => ({
          ...prev,
          edges: [makeEdge({ id: "e9", source: "a", target: "c" })],
        }));
        flush();

        expect(store.edges.map((e) => e.id)).toEqual(["e9"]);
        expect(edgeLookup.e1).toBeUndefined();
        expect(edgeLookup["xy-edge__b-c"]).toBeUndefined();
        expect(edgeLookup.e9).toBeDefined();
      },
    );
  });

  it("follows a controlled viewport prop and holds when it goes undefined", () => {
    withFlow({ nodes: [], edges: [], viewport: { x: 1, y: 1, zoom: 1 } }, ({ store, actions }) => {
      actions.setConfig((prev) => ({ ...prev, viewport: { x: 9, y: 9, zoom: 2 } }));
      flush();
      expect({ ...store.viewport }).toEqual({ x: 9, y: 9, zoom: 2 });

      actions.setConfig((prev) => ({ ...prev, viewport: undefined }));
      flush();
      expect({ ...store.viewport }).toEqual({ x: 9, y: 9, zoom: 2 });
    });
  });

  it("applies viewport, scale extent and translate extent to a late-arriving panZoom", () => {
    withFlow({ nodes: [], edges: [], minZoom: 0.25, maxZoom: 3 }, ({ actions }) => {
      const syncViewport = vi.fn();
      const setScaleExtent = vi.fn();
      const setTranslateExtent = vi.fn();
      actions.setPanZoom({
        syncViewport,
        setScaleExtent,
        setTranslateExtent,
      } as unknown as PanZoomInstance);
      flush();

      expect(syncViewport).toHaveBeenCalledWith({ x: 0, y: 0, zoom: 1 });
      expect(setScaleExtent).toHaveBeenCalledWith([0.25, 3]);
      expect(setTranslateExtent).toHaveBeenCalledTimes(1);
    });
  });

  it("exposes internal nodes both as a record and through the Map facade", () => {
    withFlow(
      { nodes: [makeNode({ id: "a", position: { x: 5, y: 6 } })], edges: [] },
      ({ internalNodes, nodeLookup }) => {
        expect(internalNodes.a?.internals.positionAbsolute).toEqual({ x: 5, y: 6 });
        // same row through both views
        expect(nodeLookup.get("a")).toBe(internalNodes.a);
        expect(() => (nodeLookup as Map<string, unknown>).set("x", {})).toThrow(/read-only/);
      },
    );
  });

  it("makes selection visible through nodeLookup synchronously (gesture boundary)", () => {
    // XYDrag reads node.selected via nodeLookup right after selection, without
    // awaiting a flush — addSelectedNodes must flush the projection itself.
    withFlow(
      { nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })], edges: [] },
      ({ nodeLookup, actions }) => {
        actions.addSelectedNodes(["a"]);

        expect(nodeLookup.get("a")?.selected).toBe(true);
        expect(nodeLookup.get("b")?.selected).toBe(false);

        actions.unselectNodesAndEdges();
        expect(nodeLookup.get("a")?.selected).toBe(false);
      },
    );
  });

  it("moveSelectedNodes writes the user graph and re-derives child absolutes", () => {
    withFlow(
      {
        nodes: [
          makeNode({ id: "parent", position: { x: 100, y: 100 }, selected: true }),
          makeNode({ id: "child", position: { x: 10, y: 10 }, parentId: "parent" }),
        ],
        edges: [],
      },
      ({ store, nodeLookup, actions }) => {
        actions.moveSelectedNodes({ x: 1, y: 0 }, 1);
        flush();

        // default velocity is 5px per keypress
        expect(store.nodes[0]!.position).toEqual({ x: 105, y: 100 });
        expect(nodeLookup.get("parent")?.internals.positionAbsolute).toEqual({ x: 105, y: 100 });
        // the unselected child derives its absolute position from the parent
        expect(store.nodes[1]!.position).toEqual({ x: 10, y: 10 });
        expect(nodeLookup.get("child")?.internals.positionAbsolute).toEqual({ x: 115, y: 110 });
      },
    );
  });

  it("does not move unselected or non-draggable nodes", () => {
    withFlow(
      {
        nodes: [
          makeNode({ id: "a", position: { x: 0, y: 0 }, selected: true, draggable: false }),
          makeNode({ id: "b", position: { x: 50, y: 0 } }),
        ],
        edges: [],
      },
      ({ store, actions }) => {
        actions.moveSelectedNodes({ x: 1, y: 1 }, 1);
        flush();

        expect(store.nodes[0]!.position).toEqual({ x: 0, y: 0 });
        expect(store.nodes[1]!.position).toEqual({ x: 50, y: 0 });
      },
    );
  });

  it("syncs viewport writes to the panZoom instance", () => {
    withFlow({ nodes: [], edges: [] }, ({ actions }) => {
      const syncViewport = vi.fn();
      actions.setPanZoom({
        syncViewport,
        setScaleExtent: vi.fn(),
        setTranslateExtent: vi.fn(),
      } as unknown as PanZoomInstance);
      flush();
      syncViewport.mockClear();

      actions.setViewport({ x: 42, y: 0, zoom: 1 });
      flush();

      expect(syncViewport).toHaveBeenCalledWith({ x: 42, y: 0, zoom: 1 });
    });
  });
});
