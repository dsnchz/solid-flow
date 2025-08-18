import { Position } from "@xyflow/system";
import { createEffect } from "solid-js";
import { produce } from "solid-js/store";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  SolidFlow,
  useConnection,
  useSolidFlow,
  useUpdateNodeInternals,
} from "@/index";
import type { EdgeConnection } from "@/types";

import { MovingHandleNode } from "./MovingHandleNode";

const nodeTypes = {
  movingHandle: MovingHandleNode,
};

const NodeUpdater = () => {
  const connection = useConnection();
  const { getNodes } = useSolidFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  createEffect(() => {
    if (connection()) {
      const startTime = Date.now();
      const nodeIds = getNodes().map((n) => n.id);

      const update = () => {
        if (Date.now() - startTime < 500) {
          updateNodeInternals(nodeIds);
          requestAnimationFrame(update);
        }
      };

      update();
    }
  });

  return null;
};

export const MovingHandles = () => {
  const [nodes] = createNodeStore([
    {
      id: "input",
      type: "input",
      data: { label: "input" },
      position: { x: -300, y: 0 },
      sourcePosition: Position.Right,
    },
    ...new Array(10).fill(0).map(
      (_, i) =>
        ({
          id: `${i}`,
          type: "movingHandle",
          position: { x: 0, y: i * 60 },
          data: {},
        }) as Parameters<typeof createNodeStore>[0][number],
    ),
  ]);

  const [edges, setEdges] = createEdgeStore([]);

  const onConnect = (connection: EdgeConnection) => {
    setEdges(
      (edge) => edge.id === connection.id,
      produce((edge) => {
        edge.animated = true;
      }),
    );
  };

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      minZoom={0.2}
      fitView
      connectionLineStyle={{
        stroke: "#ff0000",
        "stroke-width": "3",
      }}
    >
      <Controls />
      <Background />
      <NodeUpdater />
    </SolidFlow>
  );
};
