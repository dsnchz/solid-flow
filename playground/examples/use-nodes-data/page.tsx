import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  SolidFlow,
} from "@/index";
import type { NodeTypes } from "@/types";

import { ResultNode } from "./ResultNode";
import { TextNode } from "./TextNode";
import { UppercaseNode } from "./UppercaseNode";

const nodeTypes = {
  text: TextNode,
  uppercase: UppercaseNode,
  result: ResultNode,
} satisfies NodeTypes;

export function UseNodesData() {
  const [nodes, _setNodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "text",
      data: {
        text: "hello",
      },
      position: { x: -100, y: -50 },
    },
    {
      id: "1a",
      type: "uppercase",
      data: {
        text: "",
      },
      position: { x: 100, y: 0 },
    },
    {
      id: "2",
      type: "text",
      data: {
        text: "world",
      },
      position: { x: 0, y: 100 },
    },
    {
      id: "3",
      type: "result",
      data: {},
      position: { x: 300, y: 50 },
    },
  ]);

  const [edges, _setEdges] = createEdgeStore([
    {
      id: "e1-1a",
      source: "1",
      target: "1a",
    },
    {
      id: "e1a-3",
      source: "1a",
      target: "3",
    },
    {
      id: "e2-3",
      source: "2",
      target: "3",
    },
  ]);

  return (
    <div style={{ height: "100vh" }}>
      <style>{`
        .custom {
          background-color: #eee;
          padding: 10px;
          border-radius: 10px;
          min-width: 150px;
          text-align: center;
        }

        .custom input {
          width: 100%;
          padding: 4px;
          border: 1px solid #ccc;
          border-radius: 4px;
          margin-top: 4px;
        }
      `}</style>
      <SolidFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Controls />
        <Background variant="dots" />
        <MiniMap />
      </SolidFlow>
    </div>
  );
}
