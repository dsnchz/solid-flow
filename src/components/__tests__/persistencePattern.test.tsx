import { render } from "@solidjs/testing-library";
import { Loading } from "@solidjs/web";
import { action, createStore, refresh } from "solid-js";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

type GraphPayload = { nodes: Node[]; edges: Edge[] };

/**
 * The draft-then-commit persistence pattern (docs "Persistence" section):
 * server truth lives in an async-seeded store OUTSIDE the flow; the flow
 * seeds once from it (defaults) and owns the draft; a save action batch-
 * submits `toObject()` and refreshes server truth. The flow's uncontrolled
 * store ignores later prop changes by contract, so the refresh reconcile
 * never clobbers the draft.
 */
describe("draft-then-commit persistence pattern", () => {
  const setup = () => {
    const server: { graph: GraphPayload; saves: GraphPayload[] } = {
      graph: { nodes: [makeNode("a", 0), makeNode("c", 400)], edges: [] },
      saves: [],
    };
    let resolveLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => (resolveLoad = resolve));
    const api = {
      loadGraph: async (): Promise<GraphPayload> => {
        await loadGate;
        return {
          nodes: server.graph.nodes.map((n) => ({ ...n })),
          edges: server.graph.edges.map((e) => ({ ...e })),
        };
      },
      saveGraph: async (payload: GraphPayload) => {
        server.saves.push(payload);
        server.graph = payload;
      },
    };

    const [serverGraph] = createStore<GraphPayload>(() => api.loadGraph(), {
      nodes: [],
      edges: [],
    });

    let flowApi!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      flowApi = useSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <Loading fallback={<div data-testid="loading" />}>
        <SolidFlow
          defaultNodes={serverGraph.nodes}
          defaultEdges={serverGraph.edges}
          width={800}
          height={600}
        >
          <Probe />
        </SolidFlow>
      </Loading>
    ));

    const inDom = (id: string) =>
      container.querySelector(`.solid-flow__node[data-id="${id}"]`) !== null;

    return { api, server, serverGraph, container, inDom, resolveLoad, flowApi: () => flowApi };
  };

  it("holds the Loading fallback while server truth is unresolved, then seeds from it", async () => {
    const { container, inDom, resolveLoad } = setup();
    await tick();

    // Unresolved async seed: the flow subtree is held by the boundary.
    expect(container.querySelector('[data-testid="loading"]')).not.toBeNull();
    expect(inDom("a")).toBe(false);

    resolveLoad();
    await tick(50);
    expect(container.querySelector('[data-testid="loading"]')).toBeNull();
    expect(inDom("a")).toBe(true);
    expect(inDom("c")).toBe(true);
  });

  it("edits accumulate in the flow draft without touching server truth", async () => {
    const { server, serverGraph, inDom, resolveLoad, flowApi } = setup();
    resolveLoad();
    await tick(50);

    flowApi().addNodes(makeNode("b", 200));
    flowApi().updateNode("a", { position: { x: 999, y: 50 } });
    await tick();

    expect(inDom("b")).toBe(true);
    // Server truth untouched: no writes upstream, no saves fired.
    expect(server.saves).toHaveLength(0);
    expect(serverGraph.nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(serverGraph.nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it("save action batch-submits toObject() and the refresh reconcile leaves the draft intact", async () => {
    const { api, server, serverGraph, inDom, resolveLoad, flowApi } = setup();
    resolveLoad();
    await tick(50);

    flowApi().addNodes(makeNode("b", 200));
    flowApi().updateNode("a", { position: { x: 999, y: 50 } });
    await tick();

    const save = action(function* () {
      const { nodes, edges } = flowApi().toObject();
      yield api.saveGraph({ nodes, edges });
      refresh(serverGraph);
    });
    await save();
    await tick(50);

    // One batch save carrying the whole draft.
    expect(server.saves).toHaveLength(1);
    expect(server.saves[0]!.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(server.saves[0]!.nodes.find((n) => n.id === "a")!.position).toEqual({ x: 999, y: 50 });

    // Server truth refreshed to the saved graph.
    expect(serverGraph.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);

    // The draft is untouched by the refresh (defaults are initial-only).
    expect(inDom("a")).toBe(true);
    expect(inDom("b")).toBe(true);
    expect(flowApi().flow.nodes.find((n) => n.id === "a")!.position).toEqual({ x: 999, y: 50 });
  });

  it("a failed save leaves the draft intact for retry", async () => {
    const { server, inDom, resolveLoad, flowApi } = setup();
    resolveLoad();
    await tick(50);

    flowApi().addNodes(makeNode("b", 200));
    await tick();

    let failFirst = true;
    const flakySave = async (payload: GraphPayload) => {
      if (failFirst) {
        failFirst = false;
        throw new Error("network down");
      }
      server.saves.push(payload);
    };
    const save = action(function* () {
      const { nodes, edges } = flowApi().toObject();
      yield flakySave({ nodes, edges });
    });

    await expect(save()).rejects.toThrow("network down");
    await tick();
    // Nothing reverted: the draft is flow-owned, not an optimistic overlay.
    expect(inDom("b")).toBe(true);
    expect(server.saves).toHaveLength(0);

    await save();
    expect(server.saves).toHaveLength(1);
    expect(server.saves[0]!.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });
});
