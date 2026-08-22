import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  Panel,
  SolidFlow,
  useConnection,
} from "@/index";

export const UseConnection = () => {
  const connection = useConnection();

  const [nodes] = createNodeStore([
    {
      id: "1",
      type: "input",
      data: { label: "Node 1" },
      position: { x: 250, y: 5 },
    },
    {
      id: "2",
      type: "default",
      data: { label: "Node 2" },
      position: { x: 100, y: 200 },
    },
  ]);

  const [edges] = createEdgeStore([]);

  return (
    <SolidFlow nodes={nodes} edges={edges} fitView>
      <Controls />
      <Background variant="dots" />

      <Panel position="top-left">
        <div
          style={{
            padding: "12px",
            background: "rgba(255, 255, 255, 0.9)",
            "border-radius": "4px",
            "font-family": "monospace",
            "font-size": "12px",
          }}
        >
          <div style={{ "font-weight": "bold", "margin-bottom": "8px" }}>Connection State:</div>
          <div style={{ "margin-bottom": "4px" }}>
            <strong>inProgress:</strong> {connection().inProgress ? "true" : "false"}
          </div>
          <div style={{ "margin-bottom": "4px" }}>
            <strong>fromNode:</strong>{" "}
            {connection().fromNode ? JSON.stringify(connection().fromNode!.id) : "null"}
          </div>
          <div style={{ "margin-bottom": "4px" }}>
            <strong>fromHandle:</strong>{" "}
            {connection().fromHandle ? JSON.stringify(connection().fromHandle) : "null"}
          </div>
          <div style={{ "margin-bottom": "4px" }}>
            <strong>from:</strong> x: {connection().from?.x.toFixed(1)}, y:{" "}
            {connection().from?.y.toFixed(1)}
          </div>
          <div style={{ "margin-bottom": "4px" }}>
            <strong>to:</strong> x: {connection().to?.x.toFixed(1)}, y:{" "}
            {connection().to?.y.toFixed(1)}
          </div>
          <div style={{ "margin-bottom": "4px" }}>
            <strong>toNode:</strong>{" "}
            {connection().toNode ? JSON.stringify(connection().toNode!.id) : "null"}
          </div>
          <div>
            <strong>toHandle:</strong>{" "}
            {connection().toHandle ? JSON.stringify(connection().toHandle) : "null"}
          </div>
        </div>
      </Panel>

      <Panel position="bottom-right">
        <div
          style={{
            padding: "12px",
            background: "rgba(255, 255, 255, 0.9)",
            "border-radius": "4px",
            "font-size": "14px",
          }}
        >
          <div style={{ "font-weight": "bold", "margin-bottom": "8px" }}>Instructions:</div>
          <div>1. Drag from Node 1's source handle</div>
          <div>2. Watch the connection state update in real-time</div>
          <div>3. Drop on Node 2's target handle to create an edge</div>
        </div>
      </Panel>
    </SolidFlow>
  );
};
