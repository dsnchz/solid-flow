// @vitest-environment node
import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "@/types";

import { createFlowState } from "../createFlowState";

const makeNode = (id: string, x = 0): Node => ({
  id,
  position: { x, y: 0 },
  data: {},
  width: 100,
  height: 40,
});

/**
 * Headless harness over a CONTROLLED nodes store so tests can perform USER
 * row writes (the parity contract: user writes govern) next to flow commands.
 */
const withControlledFlow = async <T>(
  ids: readonly string[],
  run: (ctx: {
    flow: ReturnType<typeof createFlowState>;
    setNodes: ReturnType<typeof createStore<Node[]>>[1];
    selectedIds: () => string[];
  }) => T | Promise<T>,
): Promise<T> => {
  const [nodes, setNodes] = createStore<Node[]>(ids.map((id, i) => makeNode(id, i * 150)));
  let bundle!: ReturnType<typeof createFlowState>;
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    bundle = createFlowState<Node, Edge>({ nodes, edges: [] });
  });
  try {
    flush();
    const selectedIds = () =>
      bundle.flow.selection.nodes.map((n) => n.id).sort((a, b) => a.localeCompare(b));
    return await run({ flow: bundle, setNodes, selectedIds });
  } finally {
    dispose();
  }
};

/**
 * The selection writers derive their TARGET rows from the keyed presence
 * record plus the requested ids and resolve them by index — they no longer
 * walk every row. These tests pin the observable contract that must survive
 * that change: exactly the delta flips, user row writes are honored, and
 * untouched rows never acquire overlay entries.
 */
describe("selection writers (delta over the presence record)", () => {
  it("addSelectedNodes flips exactly the delta and leaves other rows untouched", async () => {
    await withControlledFlow(["a", "b", "c", "d"], ({ flow, selectedIds }) => {
      flow.actions.setMultiselectionKeyPressed(true);
      flush();
      flow.actions.addSelectedNodes(["a", "b"]);
      flush();
      expect(selectedIds()).toEqual(["a", "b"]);

      flow.actions.setMultiselectionKeyPressed(false);
      flush();
      flow.actions.addSelectedNodes(["b", "c"]);
      flush();
      expect(selectedIds()).toEqual(["b", "c"]);
      expect(flow.internalNodes.d!.selected).toBeFalsy();
    });
  });

  it("addSelectedNodes deselects a row the USER selected by a direct row write", async () => {
    await withControlledFlow(["a", "b"], ({ flow, setNodes, selectedIds }) => {
      setNodes((draft) => {
        draft[1]!.selected = true;
      });
      flush();
      expect(selectedIds()).toEqual(["b"]);

      flow.actions.addSelectedNodes(["a"]);
      flush();
      expect(selectedIds()).toEqual(["a"]);
    });
  });

  it("applySelectionDelta flips only the ids it is given", async () => {
    await withControlledFlow(["a", "b", "c", "d"], ({ flow, selectedIds }) => {
      flow.actions.applySelectionDelta({ nodes: { select: ["a", "b", "c"], deselect: [] } });
      flush();
      expect(selectedIds()).toEqual(["a", "b", "c"]);

      // Ids already in the requested state keep it; unknown ids are skipped.
      flow.actions.applySelectionDelta({
        nodes: { select: ["c", "d", "ghost"], deselect: ["a", "ghost"] },
      });
      flush();
      expect(selectedIds()).toEqual(["b", "c", "d"]);
      expect(flow.internalNodes.a!.selected).toBeFalsy();
    });
  });

  it("applySelectionDelta deselects a row the USER selected by a direct row write", async () => {
    await withControlledFlow(["a", "b"], ({ flow, setNodes, selectedIds }) => {
      setNodes((draft) => {
        draft[1]!.selected = true;
      });
      flush();
      expect(selectedIds()).toEqual(["b"]);

      flow.actions.applySelectionDelta({ nodes: { select: [], deselect: ["b"] } });
      flush();
      expect(selectedIds()).toEqual([]);
    });
  });

  it("addSelectedNodes replaces without the multiselection key and adds with it", async () => {
    await withControlledFlow(["a", "b", "c"], ({ flow, selectedIds }) => {
      flow.actions.addSelectedNodes(["a"]);
      flush();
      expect(selectedIds()).toEqual(["a"]);

      flow.actions.addSelectedNodes(["b"]);
      flush();
      expect(selectedIds()).toEqual(["b"]);

      flow.actions.setMultiselectionKeyPressed(true);
      flush();
      flow.actions.addSelectedNodes(["c", "ghost"]);
      flush();
      expect(selectedIds()).toEqual(["b", "c"]);
    });
  });

  it("handleNodeSelection reports whether it deselected (the caller blurs)", async () => {
    await withControlledFlow(["a", "b"], ({ flow, selectedIds }) => {
      expect(flow.actions.handleNodeSelection("a")).toBe(false);
      expect(selectedIds()).toEqual(["a"]);
      // selected, no unselect request, no multiselection key: stays selected
      expect(flow.actions.handleNodeSelection("a")).toBe(false);
      expect(flow.actions.handleNodeSelection("a", true)).toBe(true);
      expect(selectedIds()).toEqual([]);
    });
  });

  it("unselectNodesAndEdges with a subset clears only that subset", async () => {
    await withControlledFlow(["a", "b", "c"], ({ flow, selectedIds }) => {
      flow.actions.applySelectionDelta({ nodes: { select: ["a", "b", "c"], deselect: [] } });
      flush();
      flow.actions.unselectNodesAndEdges({ nodes: [makeNode("b")], edges: [] });
      flush();
      expect(selectedIds()).toEqual(["a", "c"]);

      flow.actions.unselectNodesAndEdges();
      flush();
      expect(selectedIds()).toEqual([]);
    });
  });

  it("updateNodePositions moves exactly the dragged rows and captures rowBefore once", async () => {
    await withControlledFlow(["a", "b", "c"], ({ flow }) => {
      const drag = (x: number) =>
        flow.actions.updateNodePositions(
          new Map([
            ["a", { position: { x, y: 0 } }],
            ["c", { position: { x: x + 300, y: 5 } }],
          ]),
          true,
        );
      drag(10);
      flush();
      drag(20);
      flush();

      const at = (id: string) => flow.internalNodes[id]!.internals.positionAbsolute;
      expect(at("a")).toEqual({ x: 20, y: 0 });
      expect(at("b")).toEqual({ x: 150, y: 0 });
      expect(at("c")).toEqual({ x: 320, y: 5 });
      expect(flow.internalNodes.a!.dragging).toBe(true);
      expect(flow.internalNodes.b!.dragging).toBeFalsy();
    });
  });

  it("updateNode resolves the row after a same-batch membership change", async () => {
    await withControlledFlow(["a", "b"], ({ flow }) => {
      // addNodes + updateNode before any flush: the index memo has not seen
      // the new membership when updateNode runs — the slot guard must catch it.
      flow.commands.addNodes(makeNode("z", 900));
      flow.commands.updateNode("z", { position: { x: 1, y: 2 } });
      flow.commands.updateNode("b", { position: { x: 7, y: 7 } });
      flush();
      expect(flow.internalNodes.z!.internals.positionAbsolute).toEqual({ x: 1, y: 2 });
      expect(flow.internalNodes.b!.internals.positionAbsolute).toEqual({ x: 7, y: 7 });
    });
  });
});
