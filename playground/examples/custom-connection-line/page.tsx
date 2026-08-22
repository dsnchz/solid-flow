import { Background, createEdgeStore, createNodeStore, SolidFlow } from "@/index";

import { ConnectionLine } from "./ConnectionLine";
import { CustomNode } from "./CustomNode";

const nodeTypes = {
  custom: CustomNode,
};

export const CustomConnectionLine = () => {
  const [nodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "connectionline-1",
      type: "custom",
      data: { label: "Node 1" },
      position: { x: 250, y: 5 },
    },
  ]);

  const [edges] = createEdgeStore([]);

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        connectionLineComponent={ConnectionLine}
      >
        <Background variant="lines" />
      </SolidFlow>
    </div>
  );
};
