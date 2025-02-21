import { Background, Controls, MiniMap, SolidFlow } from "@/components";

export const App = () => {
  const nodes = [
    {
      id: "1",
      type: "input",
      data: { label: "Input Node" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2",
      type: "custom",
      data: { label: "Node" },
      position: { x: 0, y: 150 },
    },
  ];

  // same for edges
  const edges = [
    {
      id: "1-2",
      type: "default",
      source: "1",
      target: "2",
      label: "Edge Text",
    },
  ];

  return (
    <div>
      <div>Playground App</div>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        fitView
        onNodeClick={(event) => console.log("on node click", event)}
      >
        <Controls />
        <Background variant="dots" />
        <MiniMap />
      </SolidFlow>
    </div>
  );
};
