// @vitest-environment node
import {
  type EdgeChangeset,
  type NodeChangeset,
  positionChange,
  removeChange,
  selectionChange,
} from "@xyflow/system";
import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import type { Edge, Node } from "@/types";

import { createFlowState } from "../createFlowState";
import type { SolidFlowProps } from "../flowProps";

// onNodesChange / onEdgesChange (Svelte Flow 2's onnodeschange /
// onedgeschange): the flow describes its own writes as a changeset, the
// callback may inspect, drop or add changes, and the flow applies what is
// left. Gesture and measurement writes are batched per task; commands and
// the gesture boundaries that read state back deliver at once.

const makeNode = (id: string, x = 0): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

type Ctx = {
  flow: ReturnType<typeof createFlowState>;
  nodes: Node[];
  edges: Edge[];
  selected: () => string[];
};

const withFlow = async (
  props: Partial<SolidFlowProps>,
  run: (ctx: Ctx) => void | Promise<void>,
  { controlledEdges = true } = {},
) => {
  const [nodes] = createStore<Node[]>(["a", "b", "c"].map((id, i) => makeNode(id, i * 150)));
  const [edges] = createStore<Edge[]>([{ id: "a-b", source: "a", target: "b" }]);
  let bundle!: ReturnType<typeof createFlowState>;
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    bundle = createFlowState<Node, Edge>({
      nodes,
      ...(controlledEdges ? { edges } : { defaultEdges: [] }),
      ...props,
    });
  });
  try {
    flush();
    await run({
      flow: bundle,
      nodes,
      edges,
      selected: () => bundle.flow.selection.nodes.map((n) => n.id).sort(),
    });
  } finally {
    dispose();
  }
};

const settle = async () => {
  await Promise.resolve();
  flush();
};

const node = (ctx: Ctx, id: string) => ctx.flow.flow.nodes.find((n) => n.id === id)!;

describe("onNodesChange", () => {
  it("batches a task's drag writes into one changeset and applies them after the callback", async () => {
    const calls: NodeChangeset[] = [];
    await withFlow({ onNodesChange: (changes) => calls.push(changes) }, async (ctx) => {
      ctx.flow.actions.updateNodePositions(new Map([["a", { position: { x: 10, y: 5 } }]]), true);
      ctx.flow.actions.updateNodePositions(new Map([["b", { position: { x: 20, y: 6 } }]]), true);
      expect(calls).toHaveLength(0);
      expect(node(ctx, "a").position).toEqual({ x: 0, y: 0 });

      await settle();
      expect(calls).toHaveLength(1);
      expect(calls[0]!.getByType("position")).toEqual([
        { id: "a", type: "position", position: { x: 10, y: 5 }, dragging: true },
        { id: "b", type: "position", position: { x: 20, y: 6 }, dragging: true },
      ]);
      expect(node(ctx, "a").position).toEqual({ x: 10, y: 5 });
      expect(node(ctx, "b").position).toEqual({ x: 20, y: 6 });
      expect(node(ctx, "a").dragging).toBe(true);
    });
  });

  it("applies only what the callback leaves, plus what it adds", async () => {
    await withFlow(
      {
        onNodesChange: (changes) => {
          changes.removeForNode("a");
          changes.add(selectionChange("c", true));
        },
      },
      async (ctx) => {
        ctx.flow.actions.updateNodePositions(
          new Map([
            ["a", { position: { x: 10, y: 5 } }],
            ["b", { position: { x: 20, y: 6 } }],
          ]),
          true,
        );
        await settle();
        expect(node(ctx, "a").position).toEqual({ x: 0, y: 0 });
        expect(node(ctx, "b").position).toEqual({ x: 20, y: 6 });
        expect(ctx.selected()).toEqual(["c"]);
      },
    );
  });

  it("delivers a click's selection before returning, where the drag start reads it", async () => {
    const onNodesChange = vi.fn((changes: NodeChangeset) => {
      expect(changes.toArray()).toEqual([{ id: "a", type: "select", selected: true }]);
    });
    await withFlow({ onNodesChange }, (ctx) => {
      ctx.flow.actions.handleNodeSelection("a");
      expect(onNodesChange).toHaveBeenCalledTimes(1);
      expect(ctx.flow.nodeLookup.get("a")?.selected).toBe(true);
      expect(ctx.selected()).toEqual(["a"]);
    });
  });

  it("a dropped selection change keeps the node unselected", async () => {
    await withFlow({ onNodesChange: (changes) => changes.clear() }, (ctx) => {
      ctx.flow.actions.handleNodeSelection("a");
      flush();
      expect(ctx.selected()).toEqual([]);
    });
  });

  it("describes commands as changes and delivers them at once", async () => {
    const calls: NodeChangeset[] = [];
    await withFlow({ onNodesChange: (changes) => calls.push(changes) }, (ctx) => {
      ctx.flow.commands.updateNodeData("a", { label: "A" });
      expect(calls).toHaveLength(1);
      expect(calls[0]!.toArray()).toEqual([
        { id: "a", type: "data", data: { label: "A" }, replace: false },
      ]);
      flush();
      expect(node(ctx, "a").data).toEqual({ label: "A" });

      ctx.flow.commands.updateNode("b", { position: { x: 7, y: 8 } });
      expect(calls[1]!.getByType("position")).toEqual([
        { id: "b", type: "position", position: { x: 7, y: 8 } },
      ]);
      flush();
      expect(node(ctx, "b").position).toEqual({ x: 7, y: 8 });

      ctx.flow.commands.addNodes(makeNode("d", 450));
      expect(calls[2]!.getByType("add").map((change) => change.id)).toEqual(["d"]);
      flush();
      expect(ctx.flow.flow.nodes.map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
    });
  });

  it("a dropped command change is not written", async () => {
    await withFlow({ onNodesChange: (changes) => changes.clear() }, (ctx) => {
      ctx.flow.commands.updateNodeData("a", { label: "A" });
      ctx.flow.commands.addNodes(makeNode("d", 450));
      flush();
      expect(node(ctx, "a").data).toEqual({ label: "a" });
      expect(ctx.flow.flow.nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    });
  });

  it("deletions arrive as remove changes; a dropped one keeps the node", async () => {
    const onDelete = vi.fn();
    const edgeCalls: EdgeChangeset[] = [];
    await withFlow(
      {
        onNodesChange: (changes) => {
          for (const change of changes.getByType("remove")) {
            if (change.id === "b") changes.remove(change);
          }
        },
        onEdgesChange: (changes) => edgeCalls.push(changes),
        onDelete,
      },
      async (ctx) => {
        await ctx.flow.commands.deleteElements({ nodes: [{ id: "a" }, { id: "b" }] });
        flush();
        expect(ctx.flow.flow.nodes.map((n) => n.id)).toEqual(["b", "c"]);
        expect(edgeCalls[0]!.toArray()).toEqual([removeChange("a-b")]);
        expect(ctx.flow.flow.edges).toEqual([]);
        expect(onDelete).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("queues measured dimensions like a gesture", async () => {
    const calls: NodeChangeset[] = [];
    await withFlow({ onNodesChange: (changes) => calls.push(changes) }, async (ctx) => {
      ctx.flow.actions.applyNodeChanges([
        { id: "a", type: "dimensions", dimensions: { width: 120, height: 50 } },
      ]);
      expect(calls).toHaveLength(0);
      await settle();
      expect(calls[0]!.getByType("dimensions")).toHaveLength(1);
      expect(node(ctx, "a").measured).toEqual({ width: 120, height: 50 });
    });
  });

  it("a position change the callback adds without `dragging` moves the node", async () => {
    await withFlow(
      { onNodesChange: (changes) => changes.add(positionChange("c", { x: 1, y: 2 })) },
      (ctx) => {
        ctx.flow.actions.handleNodeSelection("a");
        flush();
        expect(node(ctx, "c").position).toEqual({ x: 1, y: 2 });
      },
    );
  });
});

describe("onEdgesChange", () => {
  it("a new connection on an uncontrolled edges axis arrives as an add change", async () => {
    const calls: EdgeChangeset[] = [];
    await withFlow(
      { onEdgesChange: (changes) => calls.push(changes) },
      async (ctx) => {
        ctx.flow.actions.addEdge({
          source: "b",
          target: "c",
          sourceHandle: null,
          targetHandle: null,
        });
        await settle();
        expect(calls[0]!.getByType("add").map((change) => change.item.target)).toEqual(["c"]);
        expect(ctx.flow.flow.edges.map((edge) => edge.target)).toEqual(["c"]);
      },
      { controlledEdges: false },
    );
  });

  it("edge selection goes through the callback", async () => {
    await withFlow({ onEdgesChange: (changes) => changes.clear() }, (ctx) => {
      ctx.flow.actions.handleEdgeSelection("a-b");
      flush();
      expect(ctx.flow.flow.selection.edges).toEqual([]);
    });
  });
});
