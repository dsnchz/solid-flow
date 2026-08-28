import { action, createSignal, createStore, refresh } from "solid-js";
import { Loading } from "@solidjs/web";

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  Panel,
  SolidFlow,
  useSolidFlow,
} from "@/index";

type GraphPayload = { nodes: Node[]; edges: Edge[] };

// Fake backend: ~600ms latency, and a toggleable failure mode so the
// retry affordance can be exercised.
const createFakeApi = () => {
  let graph: GraphPayload = {
    nodes: [
      { id: "1", type: "input", data: { label: "Server node 1" }, position: { x: 250, y: 0 } },
      { id: "2", data: { label: "Server node 2" }, position: { x: 100, y: 120 } },
      { id: "3", type: "output", data: { label: "Server node 3" }, position: { x: 250, y: 240 } },
    ],
    edges: [{ id: "e1-2", source: "1", target: "2" }],
  };
  const latency = () => new Promise((resolve) => setTimeout(resolve, 600));
  return {
    failNext: false,
    async loadGraph(): Promise<GraphPayload> {
      await latency();
      return structuredClone(graph);
    },
    async saveGraph(payload: GraphPayload): Promise<void> {
      await latency();
      if (this.failNext) {
        this.failNext = false;
        throw new Error("503 Service Unavailable (simulated)");
      }
      graph = structuredClone(payload);
    },
    count: () => graph.nodes.length,
  };
};

const api = createFakeApi();

/** Lives inside the flow: drafts nodes, batch-commits via one action. */
const SavePanel = (props: { refreshServer: () => void }) => {
  const { flow, commands } = useSolidFlow();
  const [status, setStatus] = createSignal<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = createSignal<string>();

  const save = action(function* () {
    setStatus("saving");
    setError(undefined);
    const { nodes, edges } = commands.toObject();
    yield api.saveGraph({ nodes, edges });
    props.refreshServer();
    setStatus("saved");
  });

  const onSave = () => {
    save().catch((err: unknown) => {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    });
  };

  const addNode = () => {
    const id = `draft-${flow.nodes.length + 1}`;
    commands.addNodes({
      id,
      data: { label: `Draft ${id}` },
      position: { x: 60 + Math.random() * 300, y: 320 + Math.random() * 80 },
    });
  };

  return (
    <Panel position="top-left">
      <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
        <button onClick={addNode}>add node</button>
        <button onClick={onSave} disabled={status() === "saving"}>
          {status() === "saving" ? "Saving…" : "Save to server"}
        </button>
        <label style={{ "font-size": "12px" }}>
          <input type="checkbox" onChange={(e) => (api.failNext = e.currentTarget.checked)} />
          fail next save
        </label>
        <span data-testid="save-status" style={{ "font-size": "12px" }}>
          {status() === "saved" && `Saved — server holds ${api.count()} nodes`}
          {status() === "error" && `Save failed: ${error()} — draft kept, retry when ready`}
        </span>
      </div>
    </Panel>
  );
};

/**
 * Draft-then-commit persistence: server truth lives in an async-seeded store
 * OUTSIDE the flow; the flow seeds once from it and owns the draft (an
 * uncontrolled flow — completed connections and commands write membership
 * directly); Save batch-submits `toObject()` in one action and refreshes
 * server truth. The flow ignores later default changes by contract, so the
 * refresh never clobbers in-progress edits.
 */
const PersistenceFlow = () => {
  const [serverGraph] = createStore<GraphPayload>(() => api.loadGraph(), {
    nodes: [],
    edges: [],
  });

  return (
    <SolidFlow defaultNodes={serverGraph.nodes} defaultEdges={serverGraph.edges} fitView>
      <Background />
      <Controls />
      <MiniMap />
      <SavePanel refreshServer={() => refresh(serverGraph)} />
    </SolidFlow>
  );
};

export const Persistence = () => (
  <div style={{ height: "100vh" }}>
    <Loading fallback={<div style={{ padding: "16px" }}>Loading graph from server…</div>}>
      <PersistenceFlow />
    </Loading>
  </div>
);
