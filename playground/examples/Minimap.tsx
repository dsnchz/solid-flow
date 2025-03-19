import { createStore } from "solid-js/store";

import { Background, Controls, MiniMap, SolidFlow } from "@/components";
import type { Edge, Node } from "@/shared/types";

export const Minimap = () => {
  const [nodes] = createStore<Node[]>([
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

  const [edges] = createStore<Edge[]>([
    {
      id: "1-2",
      type: "default",
      source: "1",
      target: "2",
      interactionWidth: 10,
      label: "Edge Text",
      animated: true,
    },
  ]);

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      fitView
      colorMode="light"
      onNodeClick={(event) => console.log("on node click", event)}
      onError={(id, message) => console.log("on error", typeof id, typeof message)}
    >
      <Background variant="dots" />
      <Controls />
      <MiniMap />
    </SolidFlow>
  );
};
