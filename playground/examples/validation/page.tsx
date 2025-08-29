import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  Position,
  SolidFlow,
} from "@/index";

export const Validation = () => {
  const [nodes] = createNodeStore([
    {
      id: "0",
      type: "default",
      position: { x: 0, y: 150 },
      data: { label: "only connectable with B" },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "A",
      type: "default",
      position: { x: 250, y: 0 },
      data: { label: "A" },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "B",
      type: "default",
      position: { x: 250, y: 150 },
      data: { label: "B" },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "C",
      type: "default",
      position: { x: 250, y: 300 },
      data: { label: "C" },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
  ]);

  const [edges] = createEdgeStore([]);

  const defaultEdgeOptions = {
    animated: true,
  };

  return (
    <div style={{ height: "100vh" }}>
      <style>
        {`
        .solid-flow__handle.connectingto {
          background: #ff6060;
        }

        .solid-flow__handle.connectingfrom {
          background: #55dd99;
        }

        .solid-flow__handle.valid {
          background: #55dd99;
        }
      `}
      </style>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.1}
        maxZoom={2.5}
        isValidConnection={(connection) => {
          return connection.target === "B";
        }}
        defaultEdgeOptions={defaultEdgeOptions}
      >
        <Controls />
        <Background variant="dots" />
      </SolidFlow>
    </div>
  );
};
