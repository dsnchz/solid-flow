import { fireEvent, render } from "@solidjs/testing-library";
import { action, createOptimisticStore, createStore, refresh } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

/**
 * Selection sidecar (the #3085 composition, proving ground): flow-driven
 * selection lives in a library-owned keyed overlay joined at read time, with
 * best-effort write-through to user rows. One unbranched code path must
 * behave correctly over plain AND optimistic stores.
 */
describe("selection sidecar", () => {
  const renderFlow = (nodes: readonly Node[]) => {
    const utils = render(() => (
      // nodeDragThreshold puts click-selection on the flow's own
      // handleNodeSelection path (jsdom can't drive the XYDrag route).
      <SolidFlow nodes={nodes as Node[]} width={800} height={600} nodeDragThreshold={1} />
    ));
    const node = (id: string) =>
      utils.container.querySelector(`.solid-flow__node[data-id="${id}"]`)!;
    const isSelected = (id: string) => node(id).classList.contains("selected");
    return { ...utils, node, isSelected };
  };

  it("click selection works and persists over an OPTIMISTIC store", async () => {
    const api = { list: async () => [makeNode("a", 0), makeNode("c", 400)] };
    const [nodes] = createOptimisticStore<Node[]>(() => api.list(), []);
    const { node, isSelected } = renderFlow(nodes);
    await tick();

    fireEvent.click(node("a"));
    await tick();
    // The row write reverts (optimistic overlay, no action) — the sidecar
    // must carry the selection anyway.
    expect(isSelected("a")).toBe(true);

    // Selecting another node routes the deselect through the sidecar too.
    fireEvent.click(node("c"));
    await tick();
    expect(isSelected("c")).toBe(true);
    expect(isSelected("a")).toBe(false);
  });

  it("selection survives a refresh reconcile (server truth has no selected field)", async () => {
    const server = { rows: [makeNode("a", 0), makeNode("c", 400)] };
    const api = { list: async () => server.rows.map((r) => ({ ...r })) };
    const [nodes] = createOptimisticStore<Node[]>(() => api.list(), []);
    const { node, isSelected } = renderFlow(nodes);
    await tick();

    fireEvent.click(node("a"));
    await tick();
    expect(isSelected("a")).toBe(true);

    const noop = action(function* () {
      yield Promise.resolve();
      refresh(nodes);
    });
    await noop();
    await tick(50);
    expect(isSelected("a")).toBe(true);
  });

  it("updateNode/updateEdge selected routes through the sidecar over an OPTIMISTIC store", async () => {
    const api = {
      list: async () => [makeNode("a", 0), makeNode("b", 300)],
      edges: async () => [{ id: "e1", source: "a", target: "b" } as Edge],
    };
    const [nodes] = createOptimisticStore<Node[]>(() => api.list(), []);
    const [edges] = createOptimisticStore<Edge[]>(() => api.edges(), []);
    let flowApi!: ReturnType<typeof useSolidFlow>;
    const Probe = () => ((flowApi = useSolidFlow()), null);
    const { container } = render(() => (
      <SolidFlow nodes={nodes} edges={edges} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    await tick();

    flowApi.updateNode("a", { selected: true });
    flowApi.updateEdge("e1", { selected: true });
    await tick();
    expect(container.querySelector('.solid-flow__node[data-id="a"].selected')).not.toBeNull();
    expect(flowApi.flow.selection.edges.map((e) => e.id)).toEqual(["e1"]);
  });

  it("plain stores keep the write-through parity contract", async () => {
    const [nodes] = createStore<Node[]>([makeNode("a", 0), makeNode("c", 400)]);
    const { node, isSelected } = renderFlow(nodes);
    await tick();

    fireEvent.click(node("a"));
    await tick();
    expect(isSelected("a")).toBe(true);
    // Best-effort write-through landed in the USER's store.
    expect(nodes.find((n) => n.id === "a")?.selected).toBe(true);

    fireEvent.click(node("c"));
    await tick();
    expect(nodes.find((n) => n.id === "a")?.selected).toBe(false);
    expect(nodes.find((n) => n.id === "c")?.selected).toBe(true);
  });

  it("a USER row write still governs after the flow's write (row-moved precedence)", async () => {
    const [nodes, setNodes] = createStore<Node[]>([makeNode("a", 0)]);
    const { isSelected, node } = renderFlow(nodes);
    await tick();

    fireEvent.click(node("a"));
    await tick();
    expect(isSelected("a")).toBe(true);

    // User deselects through THEIR store: the row moved away from the
    // overlay's rowBefore, so the row wins.
    setNodes((draft) => {
      draft[0]!.selected = false;
    });
    await tick();
    expect(isSelected("a")).toBe(false);
  });
});
