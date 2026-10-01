// @vitest-environment node
import { Position } from "@xyflow/system";
import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, InternalNode, Node } from "@/types";

import {
  createResolvedEdges,
  edgeEndpointZ,
  type ResolvedEdgesSource,
} from "../projections/resolvedEdges";

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

  const source: ResolvedEdgesSource<Node, Edge> = {
    selectionOverlay: {},
    get edges() {
      return edgesStore;
    },
    connectionMode: "strict",
    defaultEdgeOptions: {},
    elevateEdgesOnSelect: true,
    zIndexMode: "auto",
    nodeLookup,
  };
  return { source, setEdgesStore, nodeLookup };
};

describe("createResolvedEdges (core, headless)", () => {
  it("joins edges with both endpoints and drops edges with missing nodes", () => {
    const { source } = makeSource(
      [
        { id: "e1", source: "a", target: "b" },
        { id: "ghost", source: "a", target: "missing" },
      ] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    createRoot((dispose) => {
      const resolved = createResolvedEdges(source);
      flush();
      expect(Object.keys(resolved)).toEqual(["e1"]);
      expect(resolved.e1!.sourceX).toBeTypeOf("number");
      expect(resolved.e1!.edge.id).toBe("e1");
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

    // Graph construction under the root; writes from mainline (rc.9: a root
    // body is an owned scope, so a store write inside it throws in dev).
    const { resolved, dispose } = createRoot((dispose) => ({
      dispose,
      resolved: createResolvedEdges(source),
    }));
    flush();
    const row1 = resolved.e1;

    setEdgesStore((draft) => {
      draft[1]!.selected = true;
    });
    flush();

    expect(resolved.e1).toBe(row1);
    expect(resolved.e2!.zIndex).toBeGreaterThan(0);
    dispose();
  });

  it("removes rows when their edge leaves the input", () => {
    const { source, setEdgesStore } = makeSource(
      [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "a" },
      ] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    const { resolved, dispose } = createRoot((dispose) => ({
      dispose,
      resolved: createResolvedEdges(source),
    }));
    flush();
    expect(Object.keys(resolved)).toHaveLength(2);

    setEdgesStore(() => [{ id: "e2", source: "b", target: "a" }] as Edge[]);
    flush();

    expect(Object.keys(resolved)).toEqual(["e2"]);
    dispose();
  });

  // Row-cache invalidation classes (spike 10): in-place node-geometry
  // mutations keep every object reference stable, so the per-node geometry
  // snapshot must capture VALUES for the join to see them.

  it("catches an in-place endpoint position mutation on the next derive", () => {
    const { source, setEdgesStore, nodeLookup } = makeSource(
      [{ id: "e1", source: "a", target: "b" }] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    const { resolved, dispose } = createRoot((dispose) => ({
      dispose,
      resolved: createResolvedEdges(source),
    }));
    flush();
    const sourceXBefore = resolved.e1!.sourceX;

    // same objects, mutated in place (as reconcile does to projection rows)
    nodeLookup.get("a")!.internals.positionAbsolute.x = 500;
    // any derive trigger (nodes are a plain Map in this fixture)
    setEdgesStore((draft) => {
      draft[0]!.animated = true;
    });
    flush();

    expect(resolved.e1!.sourceX).toBe(sourceXBefore + 500);
    dispose();
  });

  it("catches an in-place handle-bounds mutation on the next derive", () => {
    const { source, setEdgesStore, nodeLookup } = makeSource(
      [{ id: "e1", source: "a", target: "b" }] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    const { resolved, dispose } = createRoot((dispose) => ({
      dispose,
      resolved: createResolvedEdges(source),
    }));
    flush();
    const sourceXBefore = resolved.e1!.sourceX;

    nodeLookup.get("a")!.internals.handleBounds!.source![0]!.x += 40;
    setEdgesStore((draft) => {
      draft[0]!.animated = true;
    });
    flush();

    expect(resolved.e1!.sourceX).toBe(sourceXBefore + 40);
    dispose();
  });

  it("re-elevates an edge when its own selected flag changes", () => {
    const { source, setEdgesStore } = makeSource(
      [{ id: "e1", source: "a", target: "b" }] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100)],
    );

    const { resolved, dispose } = createRoot((dispose) => ({
      dispose,
      resolved: createResolvedEdges(source),
    }));
    flush();
    const zBefore = resolved.e1!.zIndex ?? 0;

    setEdgesStore((draft) => {
      draft[0]!.selected = true;
    });
    flush();

    expect(resolved.e1!.zIndex).toBe(zBefore + 1000);
    dispose();
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
    const source: ResolvedEdgesSource<Node, Edge> = {
      selectionOverlay: {},
      get edges() {
        edgesReads++;
        return edgesStore;
      },
      connectionMode: "strict",
      defaultEdgeOptions: {},
      elevateEdgesOnSelect: false,
      zIndexMode: "auto",
      nodeLookup,
    };

    const { resolved, dispose } = createRoot((dispose) => ({
      dispose,
      resolved: createResolvedEdges(source),
    }));
    flush();
    expect(edgesReads).toBe(1);

    // memoized: reading does not re-derive
    expect(Object.keys(resolved)).toEqual(["e1"]);
    expect(edgesReads).toBe(1);

    // unread source change still re-derives on flush
    setEdgesStore((draft) => {
      draft.push({ id: "e2", source: "b", target: "a" } as Edge);
    });
    flush();
    expect(edgesReads).toBe(2);
    expect(Object.keys(resolved)).toEqual(["e1", "e2"]);
    dispose();
  });
});

/**
 * A whole-graph replacement with FRESH edge objects of the same ids (bench
 * round 41, "set graph"): a present row stays present through leaf writes —
 * unchanged geometry readers are silent, a changed user key lands, the
 * `edge` reference is re-adopted, and a changed endpoint re-lays out.
 */
describe("createResolvedEdges — same-id replacement", () => {
  const setupWithRuns = () => {
    const { source, setEdgesStore } = makeSource(
      [{ id: "e1", source: "a", target: "b", label: "first" }] as Edge[],
      [internalNode("a", 0, 0), internalNode("b", 200, 100), internalNode("c", 400, 300)],
    );
    let resolved!: ReturnType<typeof createResolvedEdges<Node, Edge>>;
    let dispose!: () => void;
    const runs = { sourceX: 0, label: 0 };
    createRoot((d) => {
      dispose = d;
      resolved = createResolvedEdges(source);
      createEffect(
        () => resolved.e1?.sourceX,
        () => {
          runs.sourceX++;
        },
      );
      createEffect(
        () => resolved.e1?.label,
        () => {
          runs.label++;
        },
      );
    });
    flush();
    return { resolved: () => resolved, setEdgesStore, runs, dispose };
  };

  it("leaf-writes the changed edge keys and leaves the geometry silent", () => {
    const { resolved, setEdgesStore, runs, dispose } = setupWithRuns();
    const before = resolved().e1!;
    expect(runs).toEqual({ sourceX: 1, label: 1 });
    setEdgesStore(() => [{ id: "e1", source: "a", target: "b", label: "second" }] as Edge[]);
    flush();
    expect(resolved().e1).toBe(before);
    expect(resolved().e1!.label).toBe("second");
    expect(resolved().e1!.edge.label).toBe("second");
    expect(runs).toEqual({ sourceX: 1, label: 2 });
    dispose();
  });

  it("re-lays out an endpoint changed inside the fresh object", () => {
    const { resolved, setEdgesStore, runs, dispose } = setupWithRuns();
    const targetXBefore = resolved().e1!.targetX;
    setEdgesStore(() => [{ id: "e1", source: "a", target: "c", label: "first" }] as Edge[]);
    flush();
    expect(resolved().e1!.target).toBe("c");
    expect(resolved().e1!.targetX).not.toBe(targetXBefore);
    expect(resolved().e1!.targetNode?.id).toBe("c");
    expect(runs).toEqual({ sourceX: 1, label: 1 });
    dispose();
  });
});

/**
 * A re-layout of the same edge object (an endpoint moved) lands as leaf
 * writes of the changed geometry: readers of untouched keys stay silent, the
 * row keeps its identity, and a nested value or a swapped edge object still
 * goes through the adopting path. (Pin: the return-form reconcile was as
 * quiet; the difference is the per-edge commit cost, bench round 41.)
 */
describe("createResolvedEdges — re-layout of the same edge", () => {
  it("moves the geometry as leaf writes and keeps untouched readers silent", () => {
    const a = internalNode("a", 0, 0);
    const [nodes, setNodes] = createStore<Record<string, InternalNode>>({
      a,
      b: internalNode("b", 200, 100),
    });
    const { source, setEdgesStore } = makeSource(
      [{ id: "e1", source: "a", target: "b", label: "first", data: { weight: 1 } }] as Edge[],
      [],
    );
    const tracked: ResolvedEdgesSource<Node, Edge> = {
      ...source,
      nodeLookup: { get: (id) => nodes[id], size: 2 },
    };
    let resolved!: ReturnType<typeof createResolvedEdges<Node, Edge>>;
    let dispose!: () => void;
    const runs = { targetX: 0, label: 0, weight: 0 };
    createRoot((d) => {
      dispose = d;
      resolved = createResolvedEdges(tracked);
      createEffect(
        () => resolved.e1?.targetX,
        () => {
          runs.targetX++;
        },
      );
      createEffect(
        () => resolved.e1?.label,
        () => {
          runs.label++;
        },
      );
      createEffect(
        () => resolved.e1?.data?.weight,
        () => {
          runs.weight++;
        },
      );
    });
    flush();
    const before = resolved.e1!;
    expect(runs).toEqual({ targetX: 1, label: 1, weight: 1 });

    setNodes((draft) => {
      draft.b!.internals.positionAbsolute.x = 400;
    });
    flush();
    expect(resolved.e1).toBe(before);
    expect(resolved.e1!.targetX).not.toBe(200 + 46 + 4);
    expect(runs).toEqual({ targetX: 2, label: 1, weight: 1 });

    // A nested value changed on the same edge object: adopted by reference.
    setEdgesStore((draft) => {
      draft[0]!.data = { weight: 2 };
    });
    flush();
    expect(resolved.e1!.data?.weight).toBe(2);
    expect(runs.weight).toBe(2);
    expect(runs.targetX).toBe(2);
    dispose();
  });
});

/** A hidden endpoint drops the edge row (upstream parity, xyflow#5977). */
describe("createResolvedEdges — hidden endpoints", () => {
  it("produces no row while either endpoint is hidden, and restores it after", () => {
    const [nodes, setNodes] = createStore<Record<string, InternalNode>>({
      a: internalNode("a", 0, 0),
      b: internalNode("b", 200, 100),
    });
    const { source } = makeSource([{ id: "e1", source: "a", target: "b" }] as Edge[], []);
    const tracked: ResolvedEdgesSource<Node, Edge> = {
      ...source,
      nodeLookup: { get: (id) => nodes[id], size: 2 },
    };
    let resolved!: ReturnType<typeof createResolvedEdges<Node, Edge>>;
    let dispose!: () => void;
    createRoot((d) => {
      dispose = d;
      resolved = createResolvedEdges(tracked);
    });
    flush();
    expect(resolved.e1).toBeDefined();

    setNodes((draft) => {
      draft.b!.hidden = true;
    });
    flush();
    expect(resolved.e1).toBeUndefined();

    setNodes((draft) => {
      draft.b!.hidden = false;
    });
    flush();
    expect(resolved.e1).toBeDefined();
    dispose();
  });
});

/**
 * Edge elevation on node selection (elevateEdgesOnSelect, the default): the
 * endpoint part of the edge's z is added where the z is drawn, so a node
 * selection does not re-run the edge's row, geometry included (bench round
 * 65: a node select-all re-ran every edge row through its z).
 */
describe("createResolvedEdges — endpoint z", () => {
  it("a node selection re-runs no edge row; the drawn z still rises", () => {
    const [nodes, setNodes] = createStore<Record<string, InternalNode>>({
      a: internalNode("a", 0, 0),
      b: internalNode("b", 200, 100),
    });
    let gets = 0;
    const nodeLookup = {
      get: (id: string) => {
        gets++;
        return nodes[id];
      },
      size: 2,
    };
    const { source } = makeSource([{ id: "e1", source: "a", target: "b" }] as Edge[], []);
    const { resolved, dispose } = createRoot((dispose) => ({
      dispose,
      resolved: createResolvedEdges({ ...source, nodeLookup }),
    }));
    flush();
    expect(resolved.e1).toBeDefined();
    const runs = gets;

    // what the node row writes on selection: the flag and the elevated z
    setNodes((draft) => {
      draft.a!.selected = true;
      draft.a!.internals.z = 1000;
    });
    flush();

    expect(gets).toBe(runs);
    expect(resolved.e1!.zIndex).toBe(0);
    expect(edgeEndpointZ(resolved.e1!, nodeLookup, true, "auto")).toBe(1000);
    expect(edgeEndpointZ(resolved.e1!, nodeLookup, false, "auto")).toBe(0);
    expect(edgeEndpointZ(resolved.e1!, nodeLookup, true, "manual")).toBe(0);
    dispose();
  });
});
