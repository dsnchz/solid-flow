import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  type NodeTypes,
  SolidFlow,
} from "@/index";

import { MultiHandleNode } from "./MultiHandleNode";
import { SingleHandleNode } from "./SingleHandleNode";

const nodeTypes: NodeTypes = {
  single: SingleHandleNode,
  multi: MultiHandleNode,
};

export const HandleConnect = () => {
  const [nodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "single",
      data: {},
      position: { x: 0, y: 0 },
    },
    {
      id: "2",
      type: "single",
      data: {},
      position: { x: 200, y: -100 },
    },
    {
      id: "3",
      type: "single",
      data: {},
      position: { x: 200, y: 100 },
    },
    {
      id: "4",
      type: "multi",
      data: {},
      position: { x: 400, y: 0 },
    },
    {
      id: "5",
      type: "multi",
      data: {},
      position: { x: 600, y: -100 },
    },
    {
      id: "6",
      type: "multi",
      data: {},
      position: { x: 600, y: 100 },
    },
  ]);

  const [edges] = createEdgeStore([
    {
      id: "e1-2",
      source: "1",
      target: "2",
    },
    {
      id: "e1-3",
      source: "1",
      target: "3",
    },
    {
      id: "e4a-5",
      source: "4",
      sourceHandle: "a",
      target: "5",
    },
    {
      id: "e4b-5",
      source: "4",
      sourceHandle: "b",
      target: "6",
    },
  ]);

  return (
    <SolidFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView colorMode="dark">
      <Controls />
      <Background variant="dots" />
      <MiniMap />
    </SolidFlow>
  );
};
