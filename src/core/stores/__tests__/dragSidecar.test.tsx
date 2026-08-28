import { render } from "@solidjs/testing-library";
import { action, createOptimisticStore, createStore, flush, refresh } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

/**
 * Drag-position slice of the #3085 sidecar composition: per-frame gesture
 * positions live in a flow-owned overlay joined at read time; the per-frame
 * row write-through stays for the parity contract (your store is live during
 * a drag on plain stores). Position values are rich enough for value-based
 * precedence: a row still at its pre-drag value means the write-through
 * reverted (overlay governs); a row at any OTHER value was written by the
 * user or a reconcile (row governs).
 */
describe("drag position sidecar", () => {
  const renderFlow = (nodes: readonly Node[]) => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      return null;
    };
    const utils = render(() => (
      <SolidFlow nodes={nodes as Node[]} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    // Simulated XYDrag gesture: per-frame position writes, then drag end.
    const dragTo = (id: string, x: number, y: number, dragging = true) => {
      internal.actions.updateNodePositions(new Map([[id, { position: { x, y } }]]), dragging);
      flush(); // gesture boundary: XYDrag reads back synchronously
    };
    const absolute = (id: string) => {
      const { x, y } = internal.nodeLookup.get(id)!.internals.positionAbsolute;
      return { x, y };
    };
    return { ...utils, internal: () => internal, dragTo, absolute };
  };

  it("dragging works and the position sticks over an OPTIMISTIC store", async () => {
    const api = { list: async () => [makeNode("a", 0)] };
    const [nodes] = createOptimisticStore<Node[]>(() => api.list(), []);
    const { dragTo, absolute, internal } = renderFlow(nodes);
    await tick();

    dragTo("a", 50, 25);
    expect(absolute("a")).toEqual({ x: 50, y: 25 });
    expect(internal().nodeLookup.get("a")!.dragging).toBe(true);

    dragTo("a", 120, 60, false);
    await tick(30);
    // The per-frame row write-through reverted; the overlay must carry it.
    expect(absolute("a")).toEqual({ x: 120, y: 60 });
    expect(internal().nodeLookup.get("a")!.dragging).toBe(false);
  });

  it("the dragged position survives a refresh reconcile over an OPTIMISTIC store", async () => {
    const server = { rows: [makeNode("a", 0)] };
    const api = { list: async () => server.rows.map((r) => ({ ...r })) };
    const [nodes] = createOptimisticStore<Node[]>(() => api.list(), []);
    const { dragTo, absolute } = renderFlow(nodes);
    await tick();

    dragTo("a", 120, 60);
    dragTo("a", 120, 60, false);
    await tick(30);

    const noop = action(function* () {
      yield Promise.resolve();
      refresh(nodes);
    });
    await noop();
    await tick(50);
    // Server truth still says {0,0} — the row returned to its pre-drag
    // value, so the overlay keeps governing.
    expect(absolute("a")).toEqual({ x: 120, y: 60 });
  });

  it("plain stores stay live during the drag (write-through parity)", async () => {
    const [nodes] = createStore<Node[]>([makeNode("a", 0)]);
    const { dragTo, absolute } = renderFlow(nodes);
    await tick();

    dragTo("a", 50, 25);
    // Mid-drag: the USER's store already shows the frame's position.
    expect(nodes[0]!.position).toEqual({ x: 50, y: 25 });
    expect(nodes[0]!.dragging).toBe(true);

    dragTo("a", 120, 60, false);
    await tick(30);
    expect(nodes[0]!.position).toEqual({ x: 120, y: 60 });
    expect(absolute("a")).toEqual({ x: 120, y: 60 });
  });

  it("a later USER position write governs (row moved off its pre-drag value)", async () => {
    const [nodes, setNodes] = createStore<Node[]>([makeNode("a", 0)]);
    const { dragTo, absolute } = renderFlow(nodes);
    await tick();

    dragTo("a", 120, 60);
    dragTo("a", 120, 60, false);
    await tick(30);
    expect(absolute("a")).toEqual({ x: 120, y: 60 });

    setNodes((draft) => {
      draft[0]!.position = { x: 7, y: 7 };
    });
    await tick(30);
    expect(absolute("a")).toEqual({ x: 7, y: 7 });
  });

  it("undo back to the exact pre-drag position works on a plain store", async () => {
    const [nodes, setNodes] = createStore<Node[]>([makeNode("a", 0)]);
    const { dragTo, absolute } = renderFlow(nodes);
    await tick();

    dragTo("a", 120, 60);
    dragTo("a", 120, 60, false);
    await tick(30);

    // Undo: restore the original {0,0}. On a plain store the overlay entry
    // has been released post-confirmation, so the row governs.
    setNodes((draft) => {
      draft[0]!.position = { x: 0, y: 0 };
    });
    await tick(30);
    expect(absolute("a")).toEqual({ x: 0, y: 0 });
  });
});
