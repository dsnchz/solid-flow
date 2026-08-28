import { render } from "@solidjs/testing-library";
import { action, createOptimisticStore, refresh } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
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
 * ASPIRATIONAL — currently red, skipped. Spike findings (2026-08-27, spikes
 * p32/26-27 + this file's history):
 *
 * `createOptimisticStore` as the `nodes` prop is silently incompatible today.
 * Controlled seeding WRAPS the user's store (write-through is the controlled
 * contract), so every flow-internal write (selection, drag, addNodes) becomes
 * an optimistic-overlay write outside any action — which reverts immediately,
 * on every build. All flow commands go inert; no error, nothing renders.
 *
 * Copy-seeding instead doesn't work either: the seeding effect tracks
 * structurally (length + slot identity), so the part-2 canonical in-place row
 * mutation (`setNodes(d => { d[i].completed = v })`) never fires it — the
 * flow would miss user updates.
 *
 * The viable shape is a fine-grained per-row mirror (projection-pattern) for
 * flow-internal state layered over the user's optimistic store, entered
 * through tagged createOptimisticNodeStore/createOptimisticEdgeStore
 * factories (raw optimistic stores are undetectable). Un-skip when built.
 */
describe.skip("createOptimisticStore compat", () => {
  const setup = async (server: { rows: Node[] }) => {
    const api = {
      list: async () => server.rows.map((r) => ({ ...r })),
      add: async (node: Node) => {
        server.rows.push({ ...node });
      },
    };
    const [nodes, setNodes] = createOptimisticStore<Node[]>(() => api.list(), []);

    let flowApi!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      flowApi = useSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow nodes={nodes} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    await tick();

    const inDom = (id: string) =>
      container.querySelector(`.solid-flow__node[data-id="${id}"]`) !== null;

    return { api, nodes, setNodes, flowApi, container, inDom };
  };

  it("optimistic add appears immediately and survives a confirming refresh", async () => {
    const server = { rows: [makeNode("a", 0)] };
    const { api, nodes, setNodes, inDom } = await setup(server);
    expect(inDom("a")).toBe(true);

    let releaseAdd!: () => void;
    const gate = new Promise<void>((resolve) => (releaseAdd = resolve));

    const addNode = action(function* (node: Node) {
      setNodes((draft) => {
        draft.push(node);
      });
      yield gate.then(() => api.add(node));
      refresh(nodes);
    });

    void addNode(makeNode("b", 200));
    await tick();
    // Optimistic overlay: visible in the flow before the server confirms.
    expect(inDom("b")).toBe(true);

    releaseAdd();
    await tick(50);
    // Confirmed by refresh: still there after the overlay resolves.
    expect(inDom("b")).toBe(true);
    expect(inDom("a")).toBe(true);
  });

  it("rejected action drops the overlay and the flow reverts", async () => {
    const server = { rows: [makeNode("a", 0)] };
    const { nodes, setNodes, inDom } = await setup(server);

    let rejectAdd!: (err: Error) => void;
    const gate = new Promise<void>((_, reject) => (rejectAdd = reject));

    const addNode = action(function* (node: Node) {
      setNodes((draft) => {
        draft.push(node);
      });
      yield gate;
      refresh(nodes);
    });

    addNode(makeNode("b", 200)).catch(() => {});
    await tick();
    expect(inDom("b")).toBe(true);

    rejectAdd(new Error("server said no"));
    await tick(50);
    // Overlay dropped: only the truth remains.
    expect(inDom("b")).toBe(false);
    expect(inDom("a")).toBe(true);
  });

  it("flow-internal state (selection, moved position) survives a confirming refresh", async () => {
    const server = { rows: [makeNode("a", 0), makeNode("c", 400)] };
    const { api, nodes, setNodes, flowApi, container, inDom } = await setup(server);

    // Internal writes on an UNRELATED node while an action is in flight:
    // select "c" and move it (drag-equivalent write through the flow api).
    flowApi.updateNode("c", { position: { x: 999, y: 50 } });
    flowApi.updateNode("c", { selected: true });
    await tick();
    expect(container.querySelector('.solid-flow__node[data-id="c"].selected')).not.toBeNull();

    let releaseAdd!: () => void;
    const gate = new Promise<void>((resolve) => (releaseAdd = resolve));
    const addNode = action(function* (node: Node) {
      setNodes((draft) => {
        draft.push(node);
      });
      yield gate.then(() => api.add(node));
      refresh(nodes);
    });

    void addNode(makeNode("b", 200));
    releaseAdd();
    await tick(50);
    expect(inDom("b")).toBe(true);

    // The reconcile must not clobber flow-owned state on untouched rows.
    const c = flowApi.flow.nodes.find((n) => n.id === "c")!;
    expect(c.position).toEqual({ x: 999, y: 50 });
    expect(container.querySelector('.solid-flow__node[data-id="c"].selected')).not.toBeNull();
  });

  it("flow commands (with their flush boundaries) work inside an open action transaction", async () => {
    const server = { rows: [makeNode("a", 0)] };
    const { api, nodes, flowApi, inDom, container } = await setup(server);

    let releaseAdd!: () => void;
    const gate = new Promise<void>((resolve) => (releaseAdd = resolve));

    // A user action that calls FLOW commands (addNodes; selection commands
    // flush() internally) while the transaction is open.
    const combined = action(function* (node: Node) {
      flowApi.addNodes(node);
      flowApi.updateNode(node.id, { selected: true });
      yield gate.then(() => api.add(node));
      refresh(nodes);
    });

    void combined(makeNode("b", 200));
    await tick();
    expect(inDom("b")).toBe(true);
    expect(container.querySelector('.solid-flow__node[data-id="b"].selected')).not.toBeNull();

    releaseAdd();
    await tick(50);
    expect(inDom("b")).toBe(true);
  });
});
