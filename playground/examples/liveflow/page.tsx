import { createSignal } from "solid-js";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  Panel,
  SolidFlow,
  type SolidFlowNode,
} from "@/index";
const RING = 6;

/**
 * Live flows: an async GENERATOR as the node-store source ("a value that
 * keeps arriving", SolidJS 2.0). Here a fake server pushes a new graph state
 * every 800ms — nodes orbit, and a transient node joins and leaves the ring.
 * In a real app this generator is a `live()` server function subscribed to
 * your collaboration backend; the store, and therefore the flow, follows
 * every yield with fine-grained updates.
 */
export const LiveFlow = () => {
  const [ticks, setTicks] = createSignal(0);

  const graphAt = (t: number): SolidFlowNode[] => {
    const nodes: SolidFlowNode[] = [];
    for (let i = 0; i < RING; i++) {
      const angle = (i / RING) * Math.PI * 2 + t * 0.15;
      nodes.push({
        id: `ring-${i}`,
        type: "default",
        data: { label: `Peer ${i + 1}` },
        position: { x: 380 + Math.cos(angle) * 240, y: 280 + Math.sin(angle) * 180 },
      });
    }
    // A collaborator that joins for a while, then leaves.
    if (t % 10 < 6) {
      nodes.push({
        id: "visitor",
        type: "output",
        data: { label: "Visitor (transient)" },
        position: { x: 380, y: 280 },
      });
    }
    return nodes;
  };

  const [nodes] = createNodeStore(async function* () {
    for (let t = 0; ; t++) {
      yield graphAt(t);
      setTicks(t + 1);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  });

  const [edgeStore] = createEdgeStore(
    Array.from({ length: RING }, (_, i) => ({
      id: `e-${i}`,
      source: `ring-${i}`,
      target: `ring-${(i + 1) % RING}`,
      animated: true,
    })),
  );

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow nodes={nodes} edges={edgeStore} fitView>
        <Background variant="dots" />
        <Controls />
        <MiniMap />
        <Panel position="top-left">
          <span data-testid="live-status" style={{ "font-size": "12px" }}>
            {ticks() === 0 ? "connecting…" : `live — ${ticks()} server updates received`}
          </span>
        </Panel>
      </SolidFlow>
    </div>
  );
};
