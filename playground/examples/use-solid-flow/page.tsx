import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  SolidFlow,
} from "@/index";

import { Flow } from "./Flow";

export function UseSolidFlow() {
  const nodeTypes = {};
  const edgeTypes = {};

  const initialNodes = [
    {
      id: "1",
      type: "input" as const,
      data: { label: "Input Node" },
      position: { x: 150, y: 5 },
    },
    {
      id: "2",
      type: "default" as const,
      data: { label: "Node" },
      position: { x: 0, y: 150 },
    },
    {
      id: "3",
      type: "output" as const,
      data: { label: "Output Node" },
      position: { x: 300, y: 150 },
    },
  ];

  const initialEdges = [
    {
      id: "1-2",
      type: "default" as const,
      source: "1",
      target: "2",
      label: "Edge Text",
    },
    {
      id: "1-3",
      type: "smoothstep" as const,
      source: "1",
      target: "3",
    },
  ];

  const [nodes, _setNodes] = createNodeStore(initialNodes);
  const [edges, _setEdges] = createEdgeStore(initialEdges);

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <SolidFlow
        nodes={nodes()}
        edges={edges()}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        maxZoom={4}
        style={{ flex: 1 }}
      >
        <Controls />
        <Background variant="dots" />
        <MiniMap />
      </SolidFlow>
      <Flow />
    </div>
  );
}
