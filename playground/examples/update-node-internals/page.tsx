import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  Panel,
  SolidFlow,
  useSolidFlow,
} from "@/index";
import type { NodeTypes } from "@/types";

import { CustomNode } from "./CustomNode";

const nodeTypes = {
  custom: CustomNode,
} satisfies NodeTypes;

export const UpdateNodeInternals = () => {
  const [nodes, setNodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "custom",
      data: { label: "Input Node" },
      position: { x: 150, y: 0 },
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
      source: "1",
      target: "2",
    },
    {
      id: "1-3",
      source: "1",
      target: "3",
    },
  ]);

  const { updateNode: _updateNode } = useSolidFlow();

  const updateNodePosition = () => {
    setNodes(
      (node) => node.id === "1",
      (node) => ({
        ...node,
        position: { x: node.position.x + 10, y: node.position.y },
      }),
    );
  };

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <SolidFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView style={{ flex: 1 }}>
        <Controls />
        <Background variant="dots" />
        <MiniMap />

        <Panel>
          <button onClick={updateNodePosition}>update node</button>
        </Panel>
      </SolidFlow>
    </div>
  );
};
