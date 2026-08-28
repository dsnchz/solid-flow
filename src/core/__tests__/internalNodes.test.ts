// @vitest-environment node
import { infiniteExtent, type NodeOrigin, Position, type ZIndexMode } from "@xyflow/system";
import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "@/types";

import {
  calculateZ,
  createInternalNodes,
  isManualZIndexMode,
  type NodeMeasurements,
} from "../projections/internalNodes";

// Headless core tests for the adoption projection: user nodes + the
// measurements root derive into internal nodes without any DOM.

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: {},
  ...overrides,
});

const handleBounds = (nodeId: string) => ({
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
  target: null,
});

const setup = (
  initialNodes: Node[],
  options?: Partial<{
    nodeOrigin: NodeOrigin;
    elevateNodesOnSelect: boolean;
    zIndexMode: ZIndexMode;
  }>,
) => {
  const [nodes, setNodes] = createStore<Node[]>(initialNodes);
  const [measurements, setMeasurements] = createStore<NodeMeasurements>({});

  const internalNodes = createInternalNodes({
    selectionOverlay: {},
    dragOverlay: {},
    get nodes() {
      return nodes;
    },
    get measurements() {
      return measurements;
    },
    nodeOrigin: options?.nodeOrigin ?? [0, 0],
    nodeExtent: infiniteExtent,
    elevateNodesOnSelect: options?.elevateNodesOnSelect ?? true,
    zIndexMode: options?.zIndexMode,
  });

  return { internalNodes, setNodes, setMeasurements };
};

describe("isManualZIndexMode", () => {
  it("is true only for 'manual'", () => {
    expect(isManualZIndexMode("manual")).toBe(true);
    expect(isManualZIndexMode("basic")).toBe(false);
    expect(isManualZIndexMode("auto")).toBe(false);
    expect(isManualZIndexMode(undefined)).toBe(false);
  });
});

describe("calculateZ", () => {
  it("defaults to 0 for a plain node", () => {
    expect(calculateZ(makeNode({ id: "a" }), 1000)).toBe(0);
  });

  it("uses the node's explicit zIndex", () => {
    expect(calculateZ(makeNode({ id: "a", zIndex: 5 }), 1000)).toBe(5);
  });

  it("elevates selected nodes by selectedNodeZ", () => {
    expect(calculateZ(makeNode({ id: "a", zIndex: 5, selected: true }), 1000)).toBe(1005);
  });

  it("ignores selection elevation in manual mode", () => {
    expect(calculateZ(makeNode({ id: "a", zIndex: 5, selected: true }), 1000, "manual")).toBe(5);
  });
});

describe("createInternalNodes (core, headless)", () => {
  it("adopts nodes with absolute positions and the user node reference", () => {
    createRoot((dispose) => {
      const { internalNodes } = setup([makeNode({ id: "a", position: { x: 100, y: 50 } })]);
      flush();

      const internal = internalNodes.a!;
      expect(internal.internals.positionAbsolute).toEqual({ x: 100, y: 50 });
      expect(internal.internals.userNode.id).toBe("a");
      dispose();
    });
  });

  it("derives on first read, before any flush (initial-viewport contract)", () => {
    createRoot((dispose) => {
      const { internalNodes } = setup([makeNode({ id: "a", position: { x: 7, y: 9 } })]);

      // getInitialViewport reads the projection synchronously during setup
      expect(internalNodes.a?.internals.positionAbsolute).toEqual({ x: 7, y: 9 });
      dispose();
    });
  });

  it("elevates selected nodes to z=1000 by default", () => {
    createRoot((dispose) => {
      const { internalNodes } = setup([makeNode({ id: "a", selected: true })]);
      flush();
      expect(internalNodes.a!.internals.z).toBe(1000);
      dispose();
    });
  });

  it("does not elevate selected nodes when elevateNodesOnSelect is false", () => {
    createRoot((dispose) => {
      const { internalNodes } = setup([makeNode({ id: "a", selected: true })], {
        elevateNodesOnSelect: false,
      });
      flush();
      expect(internalNodes.a!.internals.z).toBe(0);
      dispose();
    });
  });

  it("does not elevate selected nodes in manual zIndexMode", () => {
    createRoot((dispose) => {
      const { internalNodes } = setup([makeNode({ id: "a", selected: true })], {
        zIndexMode: "manual",
      });
      flush();
      expect(internalNodes.a!.internals.z).toBe(0);
      dispose();
    });
  });

  it("positions child nodes relative to their parent, above the parent", () => {
    createRoot((dispose) => {
      const { internalNodes } = setup([
        makeNode({ id: "parent", position: { x: 100, y: 100 }, zIndex: 4 }),
        makeNode({ id: "child", position: { x: 10, y: 20 }, parentId: "parent" }),
      ]);
      flush();

      expect(internalNodes.child!.internals.positionAbsolute).toEqual({ x: 110, y: 120 });
      expect(internalNodes.child!.internals.z).toBeGreaterThan(internalNodes.parent!.internals.z);
      dispose();
    });
  });

  it("assigns root parent z increments in auto zIndexMode", () => {
    createRoot((dispose) => {
      const { internalNodes } = setup(
        [
          makeNode({ id: "p1", position: { x: 0, y: 0 } }),
          makeNode({ id: "c1", position: { x: 5, y: 5 }, parentId: "p1" }),
          makeNode({ id: "p2", position: { x: 200, y: 0 } }),
          makeNode({ id: "c2", position: { x: 5, y: 5 }, parentId: "p2" }),
          makeNode({ id: "loner" }),
        ],
        { zIndexMode: "auto" },
      );
      flush();

      // each root parent block sits above the previous one (increment = 10)
      expect(internalNodes.p1!.internals.z).toBe(10);
      expect(internalNodes.p2!.internals.z).toBe(20);
      expect(internalNodes.c1!.internals.z).toBeGreaterThan(internalNodes.p1!.internals.z);
      expect(internalNodes.c2!.internals.z).toBeGreaterThan(internalNodes.p2!.internals.z);
      expect(internalNodes.loner!.internals.z).toBe(0);
      dispose();
    });
  });

  it("joins DOM measurements from the measurements root", () => {
    createRoot((dispose) => {
      const { internalNodes, setMeasurements } = setup([makeNode({ id: "a" })]);
      flush();
      expect(internalNodes.a!.measured).toEqual({ width: undefined, height: undefined });
      expect(internalNodes.a!.internals.handleBounds).toBeUndefined();

      setMeasurements((draft) => {
        draft.a = { measured: { width: 120, height: 48 }, handleBounds: handleBounds("a") };
        return undefined;
      });
      flush();

      expect(internalNodes.a!.measured).toEqual({ width: 120, height: 48 });
      expect(internalNodes.a!.internals.handleBounds?.source).toHaveLength(1);
      dispose();
    });
  });

  it("user-seeded dimensions cover the pre-measurement window; a DOM measurement supersedes them", () => {
    createRoot((dispose) => {
      const { internalNodes, setMeasurements } = setup([
        makeNode({ id: "a", measured: { width: 500, height: 300 } }),
      ]);
      // Pre-measurement: the user seed governs (SSR sizing, persisted layout).
      expect(internalNodes.a!.measured).toEqual({ width: 500, height: 300 });

      setMeasurements((draft) => {
        draft.a = { measured: { width: 120, height: 48 } };
        return undefined;
      });
      flush();

      // Sidecar composition (solid#3085): the measurements root is
      // authoritative once a real measurement exists — rendering must not
      // depend on the row write-through, which reverts on optimistic stores.
      expect(internalNodes.a!.measured).toEqual({ width: 120, height: 48 });
      dispose();
    });
  });

  it("preserves measurements across a controlled nodes-array reset (two-root)", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes, setMeasurements } = setup([makeNode({ id: "a" })]);
      setMeasurements((draft) => {
        draft.a = { measured: { width: 120, height: 48 }, handleBounds: handleBounds("a") };
        return undefined;
      });
      flush();
      expect(internalNodes.a!.measured).toEqual({ width: 120, height: 48 });

      // fresh node objects, no measured — the old adoption pipeline preserved
      // measurements on the surviving internal node; the measurements root
      // survives the reset by construction
      setNodes(() => [makeNode({ id: "a", position: { x: 1, y: 1 } })]);
      flush();

      expect(internalNodes.a!.measured).toEqual({ width: 120, height: 48 });
      expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 1, y: 1 });
      dispose();
    });
  });

  it("clears handle bounds when the ingest reports a hidden node", () => {
    createRoot((dispose) => {
      const { internalNodes, setMeasurements } = setup([makeNode({ id: "a", hidden: true })]);
      setMeasurements((draft) => {
        draft.a = { measured: { width: 120, height: 48 }, handleBounds: handleBounds("a") };
        return undefined;
      });
      flush();
      expect(internalNodes.a!.internals.handleBounds).toBeDefined();

      // the ingest writes `handleBounds: undefined` for hidden nodes
      setMeasurements((draft) => {
        draft.a!.handleBounds = undefined;
        return undefined;
      });
      flush();

      expect(internalNodes.a!.internals.handleBounds).toBeUndefined();
      expect(internalNodes.a!.measured).toEqual({ width: 120, height: 48 });
      dispose();
    });
  });

  it("drops rows for removed nodes", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([makeNode({ id: "a" }), makeNode({ id: "b" })]);
      flush();
      expect(Object.keys(internalNodes).sort()).toEqual(["a", "b"]);

      setNodes(() => [makeNode({ id: "a" })]);
      flush();

      expect(Object.keys(internalNodes)).toEqual(["a"]);
      expect(internalNodes.b).toBeUndefined();
      dispose();
    });
  });

  it("does not re-run a node's position subscriber when another node moves", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([
        makeNode({ id: "a", position: { x: 0, y: 0 } }),
        makeNode({ id: "b", position: { x: 100, y: 0 } }),
      ]);
      let aRuns = 0;

      createEffect(
        () => internalNodes.a?.internals.positionAbsolute.x,
        () => {
          aRuns++;
        },
      );
      flush();
      expect(aRuns).toBe(1);

      setNodes((draft) => {
        draft[1]!.position = { x: 250, y: 50 };
        return undefined;
      });
      flush();

      expect(internalNodes.b!.internals.positionAbsolute).toEqual({ x: 250, y: 50 });
      expect(aRuns).toBe(1);
      dispose();
    });
  });

  // Row-cache invalidation classes (spike 10): every kind of input change
  // must invalidate the cached row — these pin the snapshot's coverage.

  it("catches an IN-PLACE position mutation (same object identity)", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([makeNode({ id: "a", position: { x: 1, y: 1 } })]);
      flush();

      setNodes((draft) => {
        draft[0]!.position.x = 99;
        return undefined;
      });
      flush();

      expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 99, y: 1 });
      dispose();
    });
  });

  it("catches a pass-through prop change (draggable)", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([makeNode({ id: "a", draggable: false })]);
      flush();
      expect(internalNodes.a!.draggable).toBe(false);

      setNodes((draft) => {
        draft[0]!.draggable = true;
        return undefined;
      });
      flush();

      expect(internalNodes.a!.draggable).toBe(true);
      dispose();
    });
  });

  it("catches a key that gets ADDED to the node after adoption", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([makeNode({ id: "a" })]);
      flush();
      expect(internalNodes.a!.zIndex).toBeUndefined();

      setNodes((draft) => {
        draft[0]!.zIndex = 7;
        return undefined;
      });
      flush();

      expect(internalNodes.a!.zIndex).toBe(7);
      expect(internalNodes.a!.internals.z).toBe(7);
      dispose();
    });
  });

  it("catches an in-place coordinate-extent mutation", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([
        makeNode({
          id: "a",
          position: { x: 50, y: 50 },
          extent: [
            [0, 0],
            [100, 100],
          ],
          measured: { width: 10, height: 10 },
        }),
      ]);
      flush();
      expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 50, y: 50 });

      setNodes((draft) => {
        (draft[0]!.extent as [[number, number], [number, number]])[1][0] = 30;
        return undefined;
      });
      flush();

      // clamped against the mutated extent: x <= 30 - width
      expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 20, y: 50 });
      dispose();
    });
  });

  it("replaced data repoints the row; deep data writes flow through unrebuilt", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([makeNode({ id: "a", data: { label: "first" } })]);
      flush();
      expect(internalNodes.a!.data.label).toBe("first");

      // deep write: chained backing — visible through the row with no rebuild
      setNodes((draft) => {
        draft[0]!.data.label = "deep";
        return undefined;
      });
      flush();
      expect(internalNodes.a!.data.label).toBe("deep");

      // slot replacement: row must repoint at the new object
      setNodes((draft) => {
        draft[0]!.data = { label: "replaced" };
        return undefined;
      });
      flush();
      expect(internalNodes.a!.data.label).toBe("replaced");
      dispose();
    });
  });

  it("recomputes every row when a shared config input (nodeOrigin) changes", () => {
    createRoot((dispose) => {
      const [nodes] = createStore<Node[]>([
        makeNode({ id: "a", position: { x: 100, y: 100 }, measured: { width: 50, height: 20 } }),
      ]);
      const [measurements] = createStore<NodeMeasurements>({});
      const [config, setConfig] = createStore<{ nodeOrigin: NodeOrigin }>({ nodeOrigin: [0, 0] });

      const internalNodes = createInternalNodes({
        selectionOverlay: {},
        dragOverlay: {},
        get nodes() {
          return nodes;
        },
        get measurements() {
          return measurements;
        },
        get nodeOrigin() {
          return config.nodeOrigin;
        },
        nodeExtent: infiniteExtent,
        elevateNodesOnSelect: true,
      });
      flush();
      expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 100, y: 100 });

      setConfig((draft) => {
        draft.nodeOrigin = [0.5, 0.5];
        return undefined;
      });
      flush();

      expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 75, y: 90 });
      dispose();
    });
  });

  it("updates a parent's auto z block when it gains its first child", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup(
        [makeNode({ id: "p1" }), makeNode({ id: "c1", parentId: "p1" }), makeNode({ id: "p2" })],
        { zIndexMode: "auto" },
      );
      flush();
      expect(internalNodes.p2!.internals.z).toBe(0);

      setNodes((draft) => {
        draft.push(makeNode({ id: "c2", parentId: "p2" }));
        return undefined;
      });
      flush();

      expect(internalNodes.p2!.internals.z).toBe(20);
      expect(internalNodes.c2!.internals.z).toBeGreaterThan(20);
      dispose();
    });
  });

  it("re-runs subscribers of an absent key when the node appears", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes } = setup([makeNode({ id: "a" })]);
      let seen: number | undefined;
      let runs = 0;

      createEffect(
        () => internalNodes.late?.internals.positionAbsolute.x,
        (x) => {
          runs++;
          seen = x;
        },
      );
      flush();
      expect(runs).toBe(1);
      expect(seen).toBeUndefined();

      setNodes((draft) => {
        draft.push(makeNode({ id: "late", position: { x: 42, y: 0 } }));
        return undefined;
      });
      flush();

      expect(runs).toBe(2);
      expect(seen).toBe(42);
      dispose();
    });
  });
});
