import "@/styles/style.css";

import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

import { Background, Controls, SolidFlow } from "@/components";

export const App = () => {
  const [nodes] = createStore([
    {
      id: "1",
      type: "input",
      data: { label: "Input Node" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2",
      type: "output",
      data: { label: "Output Node" },
      position: { x: 0, y: 150 },
    },
  ]);

  const [edges] = createStore([
    {
      id: "1-2",
      type: "default",
      source: "1",
      target: "2",
      label: "Edge Text",
    },
  ]);

  createEffect(() => {
    console.log("nodes", nodes);
  });

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      fitView
      colorMode="light"
      width={1000}
      height={1000}
      onNodeClick={(event) => console.log("on node click", event)}
      onError={(error) => console.log("on error", error)}
    >
      <Controls />
      <Background variant="dots" />
    </SolidFlow>
  );
};
