import { createRoot, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "~/types";

import { createSolidFlow } from "./createSolidFlow";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: {},
  ...overrides,
});

const makeEdge = (overrides: Partial<Edge> & { id: string; source: string; target: string }) =>
  ({ ...overrides }) as Edge;

const withFlow = <T,>(
  props: Parameters<typeof createSolidFlow>[0],
  run: (flow: ReturnType<typeof createSolidFlow>) => T,
): T =>
  createRoot((dispose) => {
    const flow = createSolidFlow(props);
    try {
      return run(flow);
    } finally {
      dispose();
    }
  });

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
      ({ edgeLookup, connectionLookup }) => {
        expect(edgeLookup.get("e1")?.id).toBe("e1");
        expect(connectionLookup.get("a")?.size).toBe(1);
        expect(connectionLookup.get("b")?.size).toBe(1);
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
});
