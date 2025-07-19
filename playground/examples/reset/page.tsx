import { Background, Controls, MiniMap, SolidFlow } from "@/components";
import { createNodeStore } from "@/index";

export const Reset = () => {
  const [nodes, setNodes] = createNodeStore([]);

  const resetNodesArray = () => {
    setNodes([
      {
        id: "c1",
        type: "default",
        data: { label: "1" },
        width: 100,
        height: 100,
        position: { x: 0, y: 0 },
      },
      {
        id: "c2",
        type: "default",
        data: { label: "2" },
        position: { x: 100, y: 0 },
      },
    ]);
  };

  return (
    <>
      <div>
        <button onClick={resetNodesArray}>Reset</button>
      </div>
      <SolidFlow nodes={nodes} fitView>
        <Controls />
        <Background />
        <MiniMap />
      </SolidFlow>
    </>
  );
};
