import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  type NodeTypes,
  SolidFlow,
} from "~/index";

import { DebugNode } from "./DebugNode";

const nodeTypes = {
  default: DebugNode,
} satisfies NodeTypes;

export function Subflows() {
  const [nodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "input",
      data: { label: "Node 1" },
      position: { x: 250, y: 5 },
      origin: [0.5, 0.5] as [number, number],
    },
    {
      id: "4",
      type: "default",
      data: { label: "Node 4" },
      position: { x: 100, y: 200 },
      style: { width: "500px", height: "300px" },
    },
    {
      id: "4a",
      type: "default",
      data: { label: "Node 4a" },
      position: { x: 15, y: 15 },
      parentId: "4",
      extent: [
        [0, 0],
        [100, 100],
      ] as [[number, number], [number, number]],
    },
    {
      id: "4b",
      type: "default",
      data: { label: "Node 4b" },
      position: { x: 100, y: 60 },
      style: { width: "300px", height: "200px" },
      parentId: "4",
    },
    {
      id: "4b1",
      type: "default",
      data: { label: "Node 4b1" },
      position: { x: 40, y: 20 },
      parentId: "4b",
    },
    {
      id: "4b2",
      type: "default",
      data: { label: "Node 4b2" },
      position: { x: 20, y: 100 },
      parentId: "4b",
    },
    {
      id: "5",
      type: "group",
      data: { label: "Node 5" },
      position: { x: 650, y: 250 },
      style: { width: "400px", height: "150px" },
      zIndex: 1000,
    },
    {
      id: "5a",
      type: "default",
      data: { label: "Node 5a" },
      position: { x: 0, y: 0 },
      parentId: "5",
      extent: "parent" as const,
    },
    {
      id: "5b",
      type: "default",
      data: { label: "Node 5b" },
      position: { x: 225, y: 50 },
      parentId: "5",
      expandParent: true,
    },
    {
      id: "2",
      type: "default",
      data: { label: "Node 2" },
      position: { x: 100, y: 100 },
    },
    {
      id: "3",
      type: "default",
      data: { label: "Node 3" },
      position: { x: 400, y: 100 },
    },
  ]);

  const [edges] = createEdgeStore([
    { id: "e1-2", source: "1", target: "2" },
    { id: "e1-3", source: "1", target: "3" },
    { id: "e3-4", source: "3", target: "4" },
    { id: "e3-4b", source: "3", target: "4b", zIndex: 100 },
    { id: "e4a-4b1", source: "4a", target: "4b1" },
    { id: "e4a-4b2", source: "4a", target: "4b2", zIndex: 100 },
    { id: "e4b1-4b2", source: "4b1", target: "4b2" },
  ]);

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Controls />
        <Background variant="dots" />
        <MiniMap />
      </SolidFlow>
    </div>
  );
}
