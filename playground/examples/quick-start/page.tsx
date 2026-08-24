import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  type EdgeConnection,
  MiniMap,
  Panel,
  SolidFlow,
} from "@/index";

// The README's Quick Start, verbatim (only the import specifier differs).
// e2e/quick-start.spec.ts drives it — if this drifts from the README, the
// README is broken.
export const QuickStart = () => {
  const [nodes, setNodes] = createNodeStore([
    { id: "1", type: "input", data: { label: "Input" }, position: { x: 250, y: 0 } },
    { id: "2", type: "default", data: { label: "Default" }, position: { x: 100, y: 100 } },
    { id: "3", type: "output", data: { label: "Output" }, position: { x: 250, y: 200 } },
  ]);

  const [edges, setEdges] = createEdgeStore([
    { id: "e1-2", source: "1", target: "2" },
    { id: "e2-3", source: "2", target: "3" },
  ]);

  // Your stores own which elements exist — adopt new connections into
  // your edge store (see "Who owns the data" in the README).
  const onConnect = (connection: EdgeConnection) => {
    setEdges((edges) => {
      edges.push(connection);
    });
  };

  const nudge = () => {
    // SolidJS 2.0 store writes are drafts: mutate what changed.
    setNodes((nodes) => {
      nodes[0]!.position.x += 20;
    });
  };

  return (
    <SolidFlow nodes={nodes} edges={edges} onConnect={onConnect} fitView>
      <Controls />
      <MiniMap />
      <Background variant="dots" />
      <Panel position="top-left">
        <button onClick={nudge}>Nudge first node</button>
      </Panel>
    </SolidFlow>
  );
};
