import { infiniteExtent, type NodeOrigin, Position, type ZIndexMode } from "@xyflow/system";
import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "~/types";

import {
  calculateZ,
  createInternalNodes,
  isManualZIndexMode,
  type NodeMeasurements,
} from "../internalNodes";

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

  it("lets user-provided dimensions win over measurements", () => {
    createRoot((dispose) => {
      const { internalNodes, setMeasurements } = setup([
        makeNode({ id: "a", measured: { width: 500, height: 300 } }),
      ]);
      setMeasurements((draft) => {
        draft.a = { measured: { width: 120, height: 48 } };
        return undefined;
      });
      flush();

      expect(internalNodes.a!.measured).toEqual({ width: 500, height: 300 });
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
