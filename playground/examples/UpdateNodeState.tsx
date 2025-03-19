import { createStore } from "solid-js/store";

import { Background, Controls, Panel, SolidFlow } from "@/components";
import { useFlowStore } from "@/components/contexts";
import type { Edge, Node } from "@/shared/types";

const NODE_COUNT = 100;
const SPACING = 150;

// Helper function to generate grid positions
const generateGridPositions = (count: number, spacing: number) => {
  const positions: { x: number; y: number }[] = [];
  const gridSize = Math.ceil(Math.sqrt(count));

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    positions.push({
      x: col * spacing,
      y: row * spacing,
    });
  }

  return positions;
};

export const UpdateNodeState = () => {
  const { setNodes } = useFlowStore();
  const positions = generateGridPositions(NODE_COUNT, SPACING);

  // Generate nodes
  const nodes: Node[] = positions.map((position, index) => {
    const id = (index + 1).toString();
    const isInput = index % 5 === 0;
    const isOutput = index % 7 === 0;

    let type = "default";
    if (isInput) type = "input";
    if (isOutput) type = "output";

    return {
      id,
      type,
      data: { label: `Node ${id}` },
      position,
    };
  });

  // Generate edges - connect nodes in various patterns
  const edges: Edge[] = [];

  // Add some horizontal connections
  const gridSize = Math.ceil(Math.sqrt(NODE_COUNT));
  for (let i = 0; i < NODE_COUNT - 1; i++) {
    if (i % gridSize !== gridSize - 1) {
      // not last in row
      edges.push({
        id: `${i + 1}-${i + 2}`,
        source: (i + 1).toString(),
        target: (i + 2).toString(),
        type: "default",
        animated: i % 5 === 0, // some edges animated
      });
    }
  }

  // Add some vertical connections
  for (let i = 0; i < NODE_COUNT - gridSize; i++) {
    edges.push({
      id: `${i + 1}-${i + gridSize + 1}`,
      source: (i + 1).toString(),
      target: (i + gridSize + 1).toString(),
      type: "default",
      animated: i % 7 === 0, // some edges animated
    });
  }

  // Add some diagonal connections for variety
  for (let i = 0; i < NODE_COUNT - gridSize - 1; i++) {
    if (i % 3 === 0 && i % gridSize !== gridSize - 1) {
      edges.push({
        id: `${i + 1}-${i + gridSize + 2}`,
        source: (i + 1).toString(),
        target: (i + gridSize + 2).toString(),
        type: "default",
        label: i % 9 === 0 ? `Edge ${i + 1}→${i + gridSize + 2}` : undefined,
      });
    }
  }

  const [nodesStore] = createStore<Node[]>(nodes);
  const [edgesStore] = createStore<Edge[]>(edges);

  function updatePos() {
    setNodes(
      nodes.map((node) => {
        return {
          ...node,
          position: {
            x: Math.random() * 1500,
            y: Math.random() * 1500,
          },
        };
      }),
    );
  }

  return (
    <SolidFlow
      nodes={nodesStore}
      edges={edgesStore}
      fitView
      colorMode="light"
      onNodeClick={(event) => console.log("on node click", event)}
      onError={(id, message) => console.log("on error", typeof id, typeof message)}
    >
      <Background variant="dots" />
      <Controls />
      <Panel>
        <button onClick={updatePos} class="scramble-button">
          change pos
        </button>
      </Panel>
    </SolidFlow>
  );
};
