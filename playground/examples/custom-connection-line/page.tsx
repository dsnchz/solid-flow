import {
  Background,
  createEdgeStore,
  createNodeStore,
  type EdgeConnection,
  SolidFlow,
} from "@/index";

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

  const [edges, setEdges] = createEdgeStore([]);

  // Adopt completed connections — controlled edges never auto-insert.
  const onConnect = (connection: EdgeConnection) => {
    setEdges((draft) => {
      draft.push(connection);
    });
  };

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        connectionLineComponent={ConnectionLine}
      >
        <Background variant="lines" />
      </SolidFlow>
    </div>
  );
};
