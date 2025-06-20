import { createEffect } from "solid-js";

import { Background, Controls, MiniMap, SolidFlow } from "@/components";
import { createNodeStore } from "@/index";

export const Reset = () => {
  const [nodes, setNodes] = createNodeStore([]);

  const resetNodesArray = () => {
    console.log("RESET NODES >>>>");
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

  createEffect(() => {
    console.log("USER NODES CHANGED >>>>", nodes);
  });

  return (
    <div style={{ height: "100vh" }}>
      <button onClick={resetNodesArray}>Reset</button>
      <SolidFlow nodes={nodes} fitView>
        <Controls />
        <Background />
        <MiniMap />
      </SolidFlow>
    </div>
  );
};
