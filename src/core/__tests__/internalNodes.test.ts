// @vitest-environment node
import { infiniteExtent, type NodeOrigin, Position, type ZIndexMode } from "@xyflow/system";
import { createEffect, createRoot, createSignal, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "@/types";

import type { DragOverlay } from "../dragOverlay";
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

  // rc.9 (#3500): a root body is tree construction — store writes there throw
  // REACTIVE_WRITE_IN_OWNED_SCOPE in dev. Each test below builds its graph
  // under the root and drives every write, flush and assertion from mainline.
  const mount = (...args: Parameters<typeof setup>) =>
    createRoot((dispose) => ({ dispose, ...setup(...args) }));

  it("joins DOM measurements from the measurements root", () => {
    const { internalNodes, setMeasurements, dispose } = mount([makeNode({ id: "a" })]);
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

  it("user-seeded dimensions cover the pre-measurement window; a DOM measurement supersedes them", () => {
    const { internalNodes, setMeasurements, dispose } = mount([
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

  it("preserves measurements across a controlled nodes-array reset (two-root)", () => {
    const { internalNodes, setNodes, setMeasurements, dispose } = mount([makeNode({ id: "a" })]);
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

  it("clears handle bounds when the ingest reports a hidden node", () => {
    const { internalNodes, setMeasurements, dispose } = mount([
      makeNode({ id: "a", hidden: true }),
    ]);
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

  it("drops rows for removed nodes", () => {
    const { internalNodes, setNodes, dispose } = mount([
      makeNode({ id: "a" }),
      makeNode({ id: "b" }),
    ]);
    flush();
    expect(Object.keys(internalNodes).sort()).toEqual(["a", "b"]);

    setNodes(() => [makeNode({ id: "a" })]);
    flush();

    expect(Object.keys(internalNodes)).toEqual(["a"]);
    expect(internalNodes.b).toBeUndefined();
    dispose();
  });

  it("does not re-run a node's position subscriber when another node moves", () => {
    let aRuns = 0;
    const { internalNodes, setNodes, dispose } = createRoot((dispose) => {
      const graph = setup([
        makeNode({ id: "a", position: { x: 0, y: 0 } }),
        makeNode({ id: "b", position: { x: 100, y: 0 } }),
      ]);
      createEffect(
        () => graph.internalNodes.a?.internals.positionAbsolute.x,
        () => {
          aRuns++;
        },
      );
      return { dispose, ...graph };
    });
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

  // Row-cache invalidation classes (spike 10): every kind of input change
  // must invalidate the cached row — these pin the snapshot's coverage.

  it("catches an IN-PLACE position mutation (same object identity)", () => {
    const { internalNodes, setNodes, dispose } = mount([
      makeNode({ id: "a", position: { x: 1, y: 1 } }),
    ]);
    flush();

    setNodes((draft) => {
      draft[0]!.position.x = 99;
      return undefined;
    });
    flush();

    expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 99, y: 1 });
    dispose();
  });

  it("catches a pass-through prop change (draggable)", () => {
    const { internalNodes, setNodes, dispose } = mount([makeNode({ id: "a", draggable: false })]);
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

  it("catches a key that gets ADDED to the node after adoption", () => {
    const { internalNodes, setNodes, dispose } = mount([makeNode({ id: "a" })]);
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

  it("catches an in-place coordinate-extent mutation", () => {
    const { internalNodes, setNodes, dispose } = mount([
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

  it("replaced data repoints the row; deep data writes flow through unrebuilt", () => {
    const { internalNodes, setNodes, dispose } = mount([
      makeNode({ id: "a", data: { label: "first" } }),
    ]);
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

  it("recomputes every row when a shared config input (nodeOrigin) changes", () => {
    const { internalNodes, setConfig, dispose } = createRoot((dispose) => {
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
      return { internalNodes, setConfig, dispose };
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

  it("updates a parent's auto z block when it gains its first child", () => {
    const { internalNodes, setNodes, dispose } = mount(
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

  it("re-runs subscribers of an absent key when the node appears", () => {
    let seen: number | undefined;
    let runs = 0;
    const { setNodes, dispose } = createRoot((dispose) => {
      const graph = setup([makeNode({ id: "a" })]);
      createEffect(
        () => graph.internalNodes.late?.internals.positionAbsolute.x,
        (x) => {
          runs++;
          seen = x;
        },
      );
      return { dispose, ...graph };
    });
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

describe("createInternalNodes — the user row is enumerated once per user change", () => {
  it("a measurement write re-derives the row without re-spreading the user node", () => {
    // The raw seed is a Proxy counting ownKeys: the store's own enumeration
    // reaches the target, so every `{...userNode}` spread is counted. A
    // measurement (or overlay) change must re-run the geometry only — the
    // spread ran three times per node at a 10k mount (bench round 30:
    // ~170 ms self per pass plus a presence node per key per pass, #3664).
    let enumerations = 0;
    const raw = new Proxy(makeNode({ id: "a" }), {
      ownKeys(target) {
        enumerations++;
        return Reflect.ownKeys(target);
      },
    });
    const { internalNodes, setMeasurements, setNodes } = createRoot(() => setup([raw]));
    flush();
    expect(internalNodes["a"]!.internals.positionAbsolute).toEqual({ x: 0, y: 0 });
    const afterMount = enumerations;
    expect(afterMount).toBeGreaterThan(0);

    setMeasurements((draft) => {
      draft["a"] = { measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") };
      return undefined;
    });
    flush();
    expect(internalNodes["a"]!.measured).toEqual({ width: 120, height: 60 });
    expect(enumerations).toBe(afterMount);

    // A user-row change is the one thing that must re-enumerate.
    setNodes((draft) => {
      draft[0]!.position = { x: 5, y: 5 };
      return undefined;
    });
    flush();
    expect(internalNodes["a"]!.internals.positionAbsolute).toEqual({ x: 5, y: 5 });
  });

  it("a user `selected` or `dragging` write re-derives the row without re-spreading it", () => {
    // Both are geometry-owned row keys (joined with the overlays), so the
    // derive tracks them directly and the snapshot never reads them: a
    // select-all over 10k rows is 10k leaf writes, not 10k spreads and
    // reconciles (bench round 41). The first write of a key ADDS it, which
    // the key-set memo absorbs with one enumeration and no copy; a value
    // write to an existing joined key never enumerates.
    let enumerations = 0;
    const raw = new Proxy(makeNode({ id: "a" }), {
      ownKeys(target) {
        enumerations++;
        return Reflect.ownKeys(target);
      },
    });
    const { internalNodes, setNodes } = createRoot(() => setup([raw]));
    flush();
    void internalNodes["a"]!.internals.z;
    const afterMount = enumerations;

    setNodes((draft) => {
      draft[0]!.selected = true;
      draft[0]!.dragging = true;
      return undefined;
    });
    flush();
    expect(internalNodes["a"]!.selected).toBe(true);
    expect(internalNodes["a"]!.dragging).toBe(true);
    expect(internalNodes["a"]!.internals.z).toBe(1000);
    // Bounded, not zero: the engine enumerates the raw once per ADDED key to
    // diff the key set, and the keys memo once — no copy of the row.
    expect(enumerations).toBeLessThanOrEqual(afterMount + 3);
    const afterKeyAdd = enumerations;

    setNodes((draft) => {
      draft[0]!.selected = false;
      draft[0]!.dragging = false;
      return undefined;
    });
    flush();
    expect(internalNodes["a"]!.selected).toBe(false);
    expect(internalNodes["a"]!.dragging).toBe(false);
    expect(internalNodes["a"]!.internals.z).toBe(0);
    expect(enumerations).toBe(afterKeyAdd);

    setNodes((draft) => {
      draft[0]!.selected = true;
      return undefined;
    });
    flush();
    expect(internalNodes["a"]!.internals.z).toBe(1000);
    expect(enumerations).toBe(afterKeyAdd);
  });
});

describe("createInternalNodes — flow settings are live", () => {
  it("re-derives every row when elevateNodesOnSelect or the origin changes", () => {
    const [nodes] = createStore<Node[]>([
      makeNode({ id: "a", selected: true, width: 100, height: 50 }),
    ]);
    const [measurements] = createStore<NodeMeasurements>({});
    const [elevate, setElevate] = createSignal(true);
    const [origin, setOrigin] = createSignal<NodeOrigin>([0, 0]);
    const { internalNodes, dispose } = createRoot((dispose) => ({
      dispose,
      internalNodes: createInternalNodes({
        selectionOverlay: {},
        dragOverlay: {},
        get nodes() {
          return nodes;
        },
        get measurements() {
          return measurements;
        },
        get nodeOrigin() {
          return origin();
        },
        nodeExtent: infiniteExtent,
        get elevateNodesOnSelect() {
          return elevate();
        },
      }),
    }));
    flush();
    expect(internalNodes.a!.internals.z).toBe(1000);
    expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 0, y: 0 });

    setElevate(false);
    flush();
    expect(internalNodes.a!.internals.z).toBe(0);

    setOrigin([0.5, 0.5]);
    flush();
    expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: -50, y: -25 });
    dispose();
  });
});

describe("createInternalNodes — row writes land in place", () => {
  const mount = (...args: Parameters<typeof setup>) =>
    createRoot((dispose) => ({ dispose, ...setup(...args) }));

  it("catches a key REMOVED from the node after adoption", () => {
    // The static half of the row is written only when the user row changes;
    // a removed user key must leave the row (not linger as a stale own key).
    const { internalNodes, setNodes, dispose } = mount([makeNode({ id: "a", zIndex: 7 })]);
    flush();
    expect(internalNodes.a!.zIndex).toBe(7);
    expect(internalNodes.a!.internals.z).toBe(7);

    setNodes((draft) => {
      delete draft[0]!.zIndex;
      return undefined;
    });
    flush();

    expect(internalNodes.a!.zIndex).toBeUndefined();
    expect("zIndex" in internalNodes.a!).toBe(false);
    expect(internalNodes.a!.internals.z).toBe(0);
    dispose();
  });

  it("a replaced data object shows through internals.userNode", () => {
    // The user proxy is adopted into the row by shallow copy, so a slot
    // replacement inside the user node (updateNodeData) must re-adopt it.
    const { internalNodes, setNodes, dispose } = mount([
      makeNode({ id: "a", data: { label: "first" } }),
    ]);
    flush();
    expect(internalNodes.a!.internals.userNode.data).toEqual({ label: "first" });

    setNodes((draft) => {
      draft[0]!.data = { label: "replaced" };
      return undefined;
    });
    flush();
    expect(internalNodes.a!.internals.userNode.data).toEqual({ label: "replaced" });
    dispose();
  });

  it("after a controlled reset, a replaced data object still shows through internals.userNode", () => {
    // A controlled nodes prop that yields a fresh array re-seeds the store:
    // the row keeps its store (keyed by id) but the user object is swapped,
    // and the re-adopted userNode copy must keep following slot
    // replacements (the hooks round-trip caught this, bench round 34).
    const { internalNodes, setNodes, dispose } = mount([
      makeNode({ id: "a", data: { label: "first" } }),
    ]);
    flush();
    void internalNodes.a!.data.label;

    setNodes(() => [makeNode({ id: "a", data: { label: "first" } })]);
    flush();
    setNodes((draft) => {
      draft[0]!.data = { label: "replaced" };
      return undefined;
    });
    flush();
    expect(internalNodes.a!.data).toEqual({ label: "replaced" });
    expect(internalNodes.a!.internals.userNode.data).toEqual({ label: "replaced" });
    dispose();
  });

  it("a drag-overlay move lands in the row's position, never in the user's object", () => {
    // Geometry-only runs write leaves in place: the row's position must be
    // the row's own object, not the user's position adopted by identity.
    const userPosition = { x: 10, y: 10 };
    const [nodes] = createStore<Node[]>([makeNode({ id: "a", position: userPosition })]);
    const [measurements] = createStore<NodeMeasurements>({});
    const [dragOverlay, setDragOverlay] = createStore<DragOverlay>({});
    const internalNodes = createRoot(() =>
      createInternalNodes({
        selectionOverlay: {},
        get dragOverlay() {
          return dragOverlay;
        },
        get nodes() {
          return nodes;
        },
        get measurements() {
          return measurements;
        },
        nodeOrigin: [0, 0],
        nodeExtent: infiniteExtent,
        elevateNodesOnSelect: true,
      }),
    );
    flush();
    expect(internalNodes.a!.position).toEqual({ x: 10, y: 10 });

    setDragOverlay((draft) => {
      draft["a"] = {
        position: { x: 50, y: 60 },
        dragging: true,
        rowBefore: { x: 10, y: 10 },
        row: nodes[0]!,
      };
      return undefined;
    });
    flush();

    expect(internalNodes.a!.position).toEqual({ x: 50, y: 60 });
    expect(internalNodes.a!.dragging).toBe(true);
    expect(internalNodes.a!.internals.positionAbsolute).toEqual({ x: 50, y: 60 });
    expect(nodes[0]!.position).toEqual({ x: 10, y: 10 });
    expect(userPosition).toEqual({ x: 10, y: 10 });
  });

  it("keeps position, measured and positionAbsolute identity across a measurement pass", () => {
    const { internalNodes, setMeasurements } = createRoot(() => setup([makeNode({ id: "a" })]));
    flush();
    const row = internalNodes.a!;
    const position = row.position;
    const measured = row.measured;
    const positionAbsolute = row.internals.positionAbsolute;

    setMeasurements((draft) => {
      draft["a"] = { measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") };
      return undefined;
    });
    flush();

    expect(row.measured).toEqual({ width: 120, height: 60 });
    expect(row.position).toBe(position);
    expect(row.measured).toBe(measured);
    expect(row.internals.positionAbsolute).toBe(positionAbsolute);
  });
});

/**
 * A whole-graph replacement with FRESH user objects of the same ids (bench
 * round 41, "set graph"): the row survives (keyed by id) and takes the
 * changed user keys as leaf writes — geometry readers stay silent, readers
 * of a changed (or re-created) nested object run, the userNode copy is
 * re-adopted, and a key that appeared or vanished in the fresh object
 * follows. (Pins: the reconcile path produced the same observable
 * notifications; the difference is the cost, measured by the p41 spike.)
 */
describe("createInternalNodes — same-id replacement", () => {
  const setupWithRuns = () => {
    let internalNodes!: ReturnType<typeof setup>["internalNodes"];
    let setNodes!: ReturnType<typeof setup>["setNodes"];
    let dispose!: () => void;
    const runs = { position: 0, label: 0, style: 0 };
    createRoot((d) => {
      dispose = d;
      ({ internalNodes, setNodes } = setup([
        makeNode({
          id: "a",
          position: { x: 5, y: 5 },
          data: { label: "first" },
          style: { color: "red" },
          zIndex: 2,
        }),
      ]));
      createEffect(
        () => internalNodes.a!.internals.positionAbsolute.x,
        () => {
          runs.position++;
        },
      );
      createEffect(
        () => internalNodes.a!.data.label,
        () => {
          runs.label++;
        },
      );
      createEffect(
        () => internalNodes.a!.style?.color,
        () => {
          runs.style++;
        },
      );
    });
    flush();
    return { internalNodes: () => internalNodes, setNodes, runs, dispose };
  };

  it("leaf-writes the changed user keys and leaves the unchanged ones silent", () => {
    const { internalNodes, setNodes, runs, dispose } = setupWithRuns();
    expect(runs).toEqual({ position: 1, label: 1, style: 1 });
    const fresh = makeNode({
      id: "a",
      position: { x: 5, y: 5 },
      data: { label: "second" },
      style: { color: "red" },
      hidden: false,
    });
    setNodes(() => [fresh]);
    flush();
    // A fresh nested object is adopted by reference (a swap), so its readers
    // run even when its content is equal — the same notifications the
    // reconcile path produced; the geometry reader stays silent.
    expect(runs).toEqual({ position: 1, label: 2, style: 2 });
    expect(internalNodes().a!.data.label).toBe("second");
    expect(internalNodes().a!.hidden).toBe(false);
    expect("zIndex" in internalNodes().a!).toBe(false);
    expect(internalNodes().a!.internals.userNode.data.label).toBe("second");
    expect(internalNodes().a!.internals.z).toBe(0);
    dispose();
  });

  it("lands a position and a style changed inside the fresh object", () => {
    const { internalNodes, setNodes, runs, dispose } = setupWithRuns();
    setNodes(() => [
      makeNode({
        id: "a",
        position: { x: 50, y: 5 },
        data: { label: "first" },
        style: { color: "blue" },
        zIndex: 2,
      }),
    ]);
    flush();
    expect(runs).toEqual({ position: 2, label: 2, style: 2 });
    expect(internalNodes().a!.internals.positionAbsolute).toEqual({ x: 50, y: 5 });
    expect(internalNodes().a!.position).toEqual({ x: 50, y: 5 });
    expect(internalNodes().a!.style).toEqual({ color: "blue" });
    dispose();
  });

  it("keeps following the user's data after the swap (draft write on the new object)", () => {
    const { internalNodes, setNodes, runs, dispose } = setupWithRuns();
    setNodes(() => [makeNode({ id: "a", position: { x: 5, y: 5 }, data: { label: "first" } })]);
    flush();
    setNodes((draft) => {
      draft[0]!.data.label = "third";
      return undefined;
    });
    flush();
    expect(internalNodes().a!.data.label).toBe("third");
    expect(internalNodes().a!.internals.userNode.data.label).toBe("third");
    expect(runs.label).toBe(3);
    dispose();
  });
});
