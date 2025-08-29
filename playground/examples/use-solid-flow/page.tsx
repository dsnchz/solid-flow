import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  SolidFlow,
} from "~/index";

import { Flow } from "./Flow";

export function UseSolidFlow() {
  const [nodes] = createNodeStore([
    {
      id: "1",
      type: "input",
      data: { label: "Input Node" },
      position: { x: 150, y: 5 },
    },
    {
      id: "2",
      type: "default",
      data: { label: "Node" },
      position: { x: 0, y: 150 },
    },
    {
      id: "3",
      type: "output",
      data: { label: "Output Node" },
      position: { x: 300, y: 150 },
    },
  ]);

  const [edges] = createEdgeStore([
    {
      id: "1-2",
      type: "default",
      source: "1",
      target: "2",
      label: "Edge Text",
    },
    {
      id: "1-3",
      type: "smoothstep",
      source: "1",
      target: "3",
    },
  ]);

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <SolidFlow nodes={nodes} edges={edges} fitView maxZoom={4} style={{ flex: 1 }}>
        <Controls />
        <Background variant="dots" />
        <MiniMap />
      </SolidFlow>
      <Flow />
    </div>
  );
}
