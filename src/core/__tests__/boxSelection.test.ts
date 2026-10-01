import { createRoot, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import type { Edge, IsNodeSelectable, Node } from "@/types";

import { createBoxSelection } from "../boxSelection";
import { createFlowState } from "../createFlowState";

const makeNode = (id: string, x: number, y: number, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x, y },
  data: {},
  width: 100,
  height: 40,
  ...extra,
});

// a(0,0) - b(200,0) - c(400,0), d(0,200) unconnected; e-ab, e-bc, e-ad
const nodes = [
  makeNode("a", 0, 0),
  makeNode("b", 200, 0),
  makeNode("c", 400, 0),
  makeNode("d", 0, 200),
];
const edges = [
  { id: "e-ab", source: "a", target: "b" },
  { id: "e-bc", source: "b", target: "c" },
  { id: "e-ad", source: "a", target: "d", selectable: false },
] as Edge[];

// Headless: the real flow state (node environment, identity transform, the
// geometry map filled by the row derive), with the box selection wired to it
// the way Pane wires it. Full vs partial mode is NOT testable here: xyflow's
// getNodesInside counts every node without handle bounds as inside (its
// initial-render rule), and headless nodes never get them; the e2e
// selection-box spec covers containment.
const withBox = async (
  run: (ctx: {
    box: ReturnType<typeof createBoxSelection<Node, Edge>>;
    selected: () => { nodes: string[]; edges: string[] };
    writes: ReturnType<typeof vi.fn>;
    select: (nodeIds: string[], edgeIds?: string[]) => void;
  }) => void | Promise<void>,
  options: { isNodeSelectable?: IsNodeSelectable<Node> } = {},
) => {
  let dispose!: () => void;
  let state!: ReturnType<typeof createFlowState<Node, Edge>>;
  createRoot((d) => {
    dispose = d;
    state = createFlowState<Node, Edge>({ nodes, edges });
  });
  flush();
  const writes = vi.fn((delta: Parameters<typeof state.actions.applySelectionDelta>[0]) =>
    state.actions.applySelectionDelta(delta),
  );
  const box = createBoxSelection<Node, Edge>({
    nodeLookup: state.nodeLookup,
    nodeGeometry: state.nodeGeometry,
    connections: state.connections,
    edgeLookup: state.edgeLookup,
    selectedNodeIds: state.selectedNodeIds,
    selectedEdgeIds: state.selectedEdgeIds,
    transform: () => state.store.transform,
    partial: () => false,
    isNodeSelectable: () => options.isNodeSelectable,
    isEdgeSelectable: (edge) => edge.selectable ?? true,
    applySelectionDelta: writes,
    unselectNodesAndEdges: state.actions.unselectNodesAndEdges,
  });
  const selected = () => ({
    nodes: state.flow.selection.nodes.map((n) => n.id).sort(),
    edges: state.flow.selection.edges.map((e) => e.id).sort(),
  });
  const select = (nodeIds: string[], edgeIds: string[] = []) => {
    state.actions.applySelectionSets(new Set(nodeIds), new Set(edgeIds));
    flush();
  };
  try {
    await run({ box, selected, writes, select });
  } finally {
    dispose();
  }
};

// Screen rects (identity transform): around a + b, around a + b + c.
const AB = { x: -10, y: -10, width: 320, height: 60 };
const ABC = { x: -10, y: -10, width: 520, height: 60 };

describe("createBoxSelection", () => {
  it("selects the nodes inside the rect and their selectable connected edges", async () => {
    await withBox(({ box, selected }) => {
      box.arm();
      box.begin({ keepPrevious: false });
      box.update(AB);
      flush();
      // e-ad connects a but is not selectable; e-bc connects b (selected
      // edges follow the selected nodes, as upstream).
      expect(selected()).toEqual({ nodes: ["a", "b"], edges: ["e-ab", "e-bc"] });
      expect(box.selectedNodeCount).toBe(2);
    });
  });

  it("writes only when the boxed sets change", async () => {
    await withBox(({ box, writes }) => {
      box.arm();
      box.begin({ keepPrevious: false });
      box.update(AB);
      box.update({ ...AB, width: AB.width + 5 });
      expect(writes).toHaveBeenCalledTimes(1);
      box.update(ABC);
      expect(writes).toHaveBeenCalledTimes(2);
    });
  });

  it("writes only the nodes and edges that changed on a move", async () => {
    await withBox(({ box, writes }) => {
      box.arm();
      box.begin({ keepPrevious: false });
      box.update(AB);
      box.update(ABC);
      const last = writes.mock.calls.at(-1)![0];
      expect([...last.nodes!.select]).toEqual(["c"]);
      expect([...last.nodes!.deselect]).toEqual([]);
      // e-bc was already selected through b; c brings no new edge.
      expect([...last.edges!.select]).toEqual([]);
    });
  });

  it("shrinking the box deselects what left it, keeping edges still held by a selected node", async () => {
    await withBox(({ box, selected }) => {
      box.arm();
      box.begin({ keepPrevious: false });
      box.update(ABC);
      flush();
      expect(selected()).toEqual({ nodes: ["a", "b", "c"], edges: ["e-ab", "e-bc"] });

      box.update(AB);
      flush();
      expect(selected()).toEqual({ nodes: ["a", "b"], edges: ["e-ab", "e-bc"] });

      box.update({ x: -10, y: -10, width: 120, height: 60 });
      flush();
      expect(selected()).toEqual({ nodes: ["a"], edges: ["e-ab"] });
    });
  });

  it("shrinking never drops the selection kept from before the box", async () => {
    await withBox(({ box, selected, select }) => {
      select(["c"], ["e-bc"]);
      box.arm();
      box.begin({ keepPrevious: true });
      box.update(AB);
      box.update({ x: 3000, y: 3000, width: 1, height: 1 });
      flush();
      expect(selected()).toEqual({ nodes: ["c"], edges: ["e-bc"] });
    });
  });

  it("keeps the selection from before the box when keepPrevious", async () => {
    await withBox(({ box, selected, select }) => {
      select(["d"]);
      box.arm();
      box.begin({ keepPrevious: true });
      box.update(AB);
      flush();
      expect(selected().nodes).toEqual(["a", "b", "d"]);
    });
  });

  it("deselects at begin unless keepPrevious", async () => {
    await withBox(({ box, selected, select }) => {
      select(["d"]);
      box.arm();
      box.begin({ keepPrevious: false });
      flush();
      expect(selected().nodes).toEqual([]);
      box.update(AB);
      flush();
      expect(selected().nodes).toEqual(["a", "b"]);
    });
  });

  it("filters the boxed candidates with isNodeSelectable", async () => {
    await withBox(
      ({ box, selected }) => {
        box.arm();
        box.begin({ keepPrevious: false });
        box.update(ABC);
        flush();
        expect(selected().nodes).toEqual(["a", "c"]);
      },
      { isNodeSelectable: (node) => node.id !== "b" },
    );
  });

  it("a second gesture that boxes what the first ended with still selects it", async () => {
    await withBox(({ box, selected }) => {
      box.arm();
      box.begin({ keepPrevious: false });
      box.update(AB);
      flush();
      // Second gesture: begin deselects; its first box equals the first
      // gesture's final one and must be written, not skipped as unchanged.
      box.arm();
      box.begin({ keepPrevious: false });
      box.update(AB);
      flush();
      expect(selected()).toEqual({ nodes: ["a", "b"], edges: ["e-ab", "e-bc"] });
    });
  });
});
