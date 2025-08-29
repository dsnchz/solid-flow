import type { OnConnectEnd } from "@xyflow/system";
import { createEffect, createSignal } from "solid-js";

import {
  createEdgeStore,
  createNodeStore,
  type Edge,
  type Node,
  SolidFlow,
  useNodeConnections,
  useSolidFlow,
} from "~/index";

export const AddNodeOnDropExample = () => {
  const [nodes] = createNodeStore([
    {
      id: "0",
      type: "input",
      data: { label: "Node" },
      position: { x: 0, y: 50 },
    },
  ]);
  const [edges] = createEdgeStore([]);

  const [connectingNodeId, setConnectingNodeId] = createSignal<string | null>("0");

  let idCounter = 1;
  const getId = () => `${idCounter++}`;

  const { screenToFlowPosition, flowToScreenPosition, addNodes, addEdges } = useSolidFlow();

  const connections = useNodeConnections(() => ({ id: "0", handleType: "source" }));

  createEffect(() => {
    console.log("Node connections:", connections());
  });

  const handleConnectEnd: OnConnectEnd = (event) => {
    const nodeId = connectingNodeId();
    if (!nodeId) return;

    // See if connection landed inside the flow pane
    const targetIsPane = (event.target as Partial<Element> | null)?.classList?.contains(
      "solid-flow__pane",
    );

    if (targetIsPane && "clientX" in event && "clientY" in event) {
      const id = getId();
      const position = {
        x: event.clientX,
        y: event.clientY,
      };

      const doubleTransformedPosition = flowToScreenPosition(screenToFlowPosition(position));

      console.log(
        "Is transforming in both directions (screen-flow, flow-screen) the same?",
        position.x === doubleTransformedPosition.x && position.y === doubleTransformedPosition.y,
      );

      const newNode: Node = {
        id,
        data: { label: `Node ${id}` },
        // project the screen position to pane position
        position: screenToFlowPosition(position),
        // set the origin of the new node so it is centered
        origin: [0.5, 0.0],
      };

      addNodes(newNode);

      const newEdge: Edge = {
        source: nodeId,
        target: id,
        id: `${nodeId}--${id}`,
      };

      addEdges(newEdge);
    }
  };

  return (
    <>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 2 }}
        onConnectStart={(_, { nodeId }) => {
          // Memorize the nodeId you start dragging a connection line from a node
          setConnectingNodeId(nodeId);
        }}
        onConnectEnd={handleConnectEnd}
        style={{
          "--solid-flow-handle-width": "30px",
          "--solid-flow-handle-height": "14px",
          "--solid-flow-handle-border-radius": "3px",
          "--solid-flow-handle-background-color": "#784be8",
          "--solid-flow-handle-top": "-10px",
          "--solid-flow-handle-bottom": "-10px",
          "--solid-flow-node-height": "40px",
          "--solid-flow-node-width": "150px",
          "--solid-flow-node-border-width": "2px",
          "--solid-flow-node-font-weight": "700",
          "--solid-flow-edge-stroke-width": "2",
          "--solid-flow-connectionline-stroke-width": "2",
        }}
      />
      <style>
        {`
        .solid-flow .solid-flow__handle {
          width: var(--solid-flow-handle-width);
          height: var(--solid-flow-handle-height);
          border-radius: var(--solid-flow-handle-border-radius);
          background-color: var(--solid-flow-handle-background-color);
        }

        .solid-flow .solid-flow__handle-top {
          top: var(--solid-flow-handle-top);
        }

        .solid-flow .solid-flow__handle-bottom {
          bottom: var(--solid-flow-handle-bottom);
        }

        .solid-flow .solid-flow__node {
          height: var(--solid-flow-node-height);
          width: var(--solid-flow-node-width);
          justify-content: center;
          align-items: center;
          display: flex;
          border-width: var(--solid-flow-node-border-width);
          font-weight: var(--solid-flow-node-font-weight);
        }

        .solid-flow .solid-flow__edge path,
        .solid-flow .solid-flow__connectionline path {
          stroke-width: var(--solid-flow-edge-stroke-width);
        }

        `}
      </style>
    </>
  );
};
