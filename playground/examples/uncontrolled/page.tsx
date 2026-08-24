import { Background, Controls, MiniMap, Panel, SolidFlow, useSolidFlow } from "@/index";

// Uncontrolled flow (React Flow defaultNodes/defaultEdges parity): no
// nodes/edges props, no user stores, no onConnect adoption. The flow owns
// element state — commands and completed connections write through and
// persist. e2e/uncontrolled.spec.ts drives this example.
const Toolbar = () => {
  const { addNodes, flow } = useSolidFlow();
  let added = 0;

  const addNode = () => {
    added += 1;
    addNodes({
      id: `added-${added}`,
      type: "default",
      data: { label: `Added ${added}` },
      position: { x: 420, y: 40 + added * 60 },
    });
  };

  return (
    <Panel position="top-left">
      <button onClick={addNode}>Add node</button>
      <span style={{ "margin-left": "8px" }} data-testid="node-count">
        nodes: {flow.nodes.length}
      </span>
    </Panel>
  );
};

export const Uncontrolled = () => (
  <SolidFlow
    defaultNodes={[
      { id: "1", type: "input", data: { label: "Input" }, position: { x: 250, y: 0 } },
      { id: "2", type: "default", data: { label: "Middle" }, position: { x: 100, y: 100 } },
      { id: "3", type: "output", data: { label: "Output" }, position: { x: 250, y: 200 } },
    ]}
    defaultEdges={[{ id: "e1-2", source: "1", target: "2" }]}
    fitView
  >
    <Controls />
    <MiniMap />
    <Background variant="dots" />
    <Toolbar />
  </SolidFlow>
);
