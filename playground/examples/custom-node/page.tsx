import { type Connection, Position } from "@xyflow/system";
import { createSignal } from "solid-js";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  SolidFlow,
} from "@/index";
import type { NodeTypes } from "@/types";

import { CustomColorNode } from "./CustomColorNode";

const nodeTypes = {
  colorNode: CustomColorNode,
} satisfies NodeTypes;

export function CustomNode() {
  const [backgroundColor, setBackgroundColor] = createSignal("#1A192B");

  const [nodes, _setNodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "input",
      data: { label: "An input node" },
      position: { x: 0, y: 50 },
      sourcePosition: Position.Right,
    },
    {
      id: "2",
      type: "colorNode",
      data: { backgroundColor, setBackgroundColor },
      position: { x: 250, y: 50 },
    },
    {
      id: "3",
      type: "output",
      data: { label: "Output A" },
      position: { x: 650, y: 25 },
      targetPosition: Position.Left,
    },
    {
      id: "4",
      type: "output",
      data: { label: "Output B" },
      position: { x: 650, y: 120 },
      targetPosition: Position.Left,
    },
  ]);

  const [edges, _setEdges] = createEdgeStore([
    {
      id: "e1-2",
      source: "1",
      target: "2",
      animated: true,
    },
    {
      id: "e2a-3",
      source: "2",
      sourceHandle: "a",
      target: "3",
      animated: true,
    },
    {
      id: "e2b-4",
      source: "2",
      sourceHandle: "b",
      target: "4",
      animated: true,
    },
  ]);

  const onConnect = (connection: Connection) => {
    console.log("on connect", connection);
  };

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      style={{
        "--xy-background-color": backgroundColor(),
      }}
      fitView
      onConnect={onConnect}
    >
      <Controls />
      <Background variant="dots" />
      <MiniMap />
    </SolidFlow>
  );
}
