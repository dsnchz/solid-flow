import { createEffect } from "solid-js";
import { reconcile } from "solid-js/store";

import { Background, Controls, createNodeStore, SolidFlow, useSolidFlow } from "@/index";

export function Intersections() {
  const { getIntersectingNodes } = useSolidFlow();

  const [nodes, setNodes] = createNodeStore([
    {
      id: "1",
      type: "default",
      data: { label: "Node 1" },
      position: { x: 0, y: 0 },
      style: { width: "200px", height: "100px" },
    },
    {
      id: "2",
      type: "default",
      data: { label: "Node 2" },
      position: { x: 0, y: 150 },
      parentId: "1",
    },
    {
      id: "3",
      type: "default",
      data: { label: "Node 3" },
      position: { x: 250, y: 0 },
    },
    {
      id: "4",
      type: "default",
      data: { label: "Node" },
      position: { x: 350, y: 150 },
      style: { width: "50px", height: "50px" },
    },
  ]);

  createEffect(() => {
    console.log("USERLAND NODES >>>>", nodes);
  });

  return (
    <div style={{ height: "100vh" }}>
      <style>{`
        .solid-flow .solid-flow__node.highlight {
          background-color: var(--highlight-bg, #ff0072) !important;
          color: var(--highlight-color, white) !important;
        }

        .intersection-flow .solid-flow__node {
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: 700;
          border-radius: 1px;
          border-width: 2px;
          box-shadow: 6px 6px 0 1px rgba(0, 0, 0, 0.7);
        }

        .intersection-flow .solid-flow__node.selected,
        .intersection-flow .solid-flow__node:hover,
        .intersection-flow .solid-flow__node:focus {
          box-shadow: 6px 6px 0 1px rgba(0, 0, 0, 0.7) !important;
          background-color: #eee !important;
        }

        .intersection-flow .solid-flow__handle {
          display: none;
        }
      `}</style>
      <SolidFlow
        class="intersection-flow"
        nodes={nodes}
        fitView
        onNodeDrag={({ targetNode }) => {
          if (!targetNode) return;

          const intersections = getIntersectingNodes(targetNode).map((n) => n.id);

          // Update node classes based on intersections
          const newNodes = nodes.map((node) => ({
            ...node,
            class: intersections.includes(node.id) ? "highlight" : "",
          }));

          setNodes(reconcile(newNodes));
        }}
        style={{
          "--highlight-bg": "#ff0072",
          "--highlight-color": "white",
        }}
      >
        <Background />
        <Controls />
      </SolidFlow>
    </div>
  );
}
