import { createStore } from "solid-js/store";

import { Background, Controls, type Edge, MiniMap, type Node, SolidFlow } from "~/index";

const yNodes = 25;
const xNodes = 25;

export const StressTest = () => {
  const nodeItems: Node[] = [];
  const edgeItems: Edge[] = [];

  let source: Node | null = null;

  for (let y = 0; y < yNodes; y++) {
    for (let x = 0; x < xNodes; x++) {
      const position = { x: x * 100, y: y * 50 };
      const id = `${x}-${y}`;
      const data = { label: `Node ${id}` };
      const node: Node = {
        id,
        data,
        position,
        type: "default",
      };
      nodeItems.push(node);

      // Edges removed for performance testing
      if (source) {
        const edge: Edge = {
          id: `${source.id}-${id}`,
          source: source.id,
          target: id,
        };
        edgeItems.push(edge);
      }

      source = node;
    }
  }

  const [_nodes] = createStore(nodeItems);
  const [edges] = createStore(edgeItems);

  return (
    <SolidFlow
      nodes={nodeItems}
      edges={edges}
      fitView
      minZoom={0.2}
      onlyRenderVisibleElements
      onFlowError={(id, message) => {
        console.error(id, message);
      }}
    >
      <Controls />
      <Background variant="lines" />
      <MiniMap />
    </SolidFlow>
  );
};
