import { type NodeHandle, Position } from "@xyflow/system";
import { createRoot, flush, isPending } from "solid-js";
import { describe, expect, it } from "vitest";

import { createFlowState } from "../createFlowState";
import { createNodeStore } from "../stores/createNodeStore";

// The headless server contract (README, "Server-side rendering"): against
// the SERVER builds of solid-js, constructing a flow and reading its derived
// state works, and a pending async seed reads as not-ready instead of as an
// empty graph. The browser-build core lane cannot pin this — only the server
// build re-derives through NotReadyError propagation (solid#3073).

// The seed shape the typed store factory accepts (type-narrowed data).
type SeedNode = {
  id: string;
  type: "default";
  position: { x: number; y: number };
  data: { label: string };
  width: number;
  height: number;
  handles: NodeHandle[];
};

const node = (id: string, x: number, handle: "source" | "target"): SeedNode => ({
  id,
  type: "default",
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
  handles: [
    {
      type: handle,
      position: handle === "source" ? Position.Right : Position.Left,
      x: handle === "source" ? 100 : 0,
      y: 20,
      width: 6,
      height: 6,
    },
  ],
});

describe("headless core on the server build", () => {
  it("derives internal nodes and layouted edges from declared geometry", () => {
    createRoot((dispose) => {
      const flow = createFlowState({
        nodes: [node("a", 0, "source"), node("b", 300, "target")],
        edges: [{ id: "e1", source: "a", target: "b" }],
      });
      flush();
      expect(flow.nodeLookup.get("b")?.internals.positionAbsolute).toEqual({ x: 300, y: 0 });
      const layouted = flow.actions.getLayoutedEdge("e1");
      expect(layouted).toMatchObject({ sourceX: 106, sourceY: 23, targetX: 300, targetY: 23 });
      dispose();
    });
  });

  it("a pending async seed propagates NotReadyError (the server suspends, it never branches)", async () => {
    let resolveSeed!: (rows: SeedNode[]) => void;
    const [nodes] = createNodeStore(
      () => new Promise<SeedNode[]>((resolve) => (resolveSeed = resolve)),
    );
    await createRoot(async (dispose) => {
      const flow = createFlowState({ nodes, edges: [] });
      flush();
      // Server semantics: a pending read throws so the render suspends up to
      // the nearest Loading boundary — and the server build's isPending
      // rethrows instead of answering, so it cannot be used to branch here.
      expect(() => flow.store.nodes.length).toThrow();
      expect(() => isPending(() => flow.store.nodes.length)).toThrow();

      resolveSeed([node("a", 0, "source")]);
      await new Promise((r) => setTimeout(r, 0));
      flush();
      expect(isPending(() => flow.store.nodes.length)).toBe(false);
      expect(flow.store.nodes).toHaveLength(1);
      expect(flow.nodeLookup.get("a")?.internals.positionAbsolute).toEqual({ x: 0, y: 0 });
      dispose();
    });
  });
});
