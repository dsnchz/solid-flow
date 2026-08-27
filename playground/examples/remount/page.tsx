import { createSignal, Show } from "solid-js";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  type EdgeConnection,
  MiniMap,
  SolidFlow,
} from "@/index";

// Unmount/remount the whole flow with the SAME stores — the scenario where
// React Flow loses MiniMap panning (xyflow#5971) and connection dragging
// (xyflow#5933) until a hard reload. e2e/immunity.spec.ts drives this.
export const Remount = () => {
  const [mounted, setMounted] = createSignal(true);
  const [nodes] = createNodeStore([
    { id: "1", type: "input", data: { label: "Input" }, position: { x: 250, y: 0 } },
    { id: "2", type: "default", data: { label: "Middle" }, position: { x: 100, y: 120 } },
    { id: "3", type: "output", data: { label: "Output" }, position: { x: 250, y: 240 } },
  ]);
  const [edges, setEdges] = createEdgeStore([{ id: "e1-2", source: "1", target: "2" }]);

  const onConnect = (connection: EdgeConnection) => {
    setEdges((draft) => {
      draft.push(connection);
    });
  };

  return (
    <div style={{ height: "100vh", display: "flex", "flex-direction": "column" }}>
      <div style={{ padding: "8px" }}>
        <button onClick={() => setMounted((m) => !m)}>
          {mounted() ? "Unmount flow" : "Remount flow"}
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <Show when={mounted()}>
          <SolidFlow nodes={nodes} edges={edges} onConnect={onConnect} fitView>
            <Controls />
            <MiniMap pannable />
            <Background variant="dots" />
          </SolidFlow>
        </Show>
      </div>
    </div>
  );
};
