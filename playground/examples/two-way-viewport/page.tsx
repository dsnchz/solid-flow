import type { Viewport } from "@xyflow/system";
import { createStore } from "solid-js/store";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  Panel,
  SolidFlow,
  useSolidFlow,
  useViewport,
} from "@/index";

export const TwoWayViewport = () => {
  const [nodes] = createNodeStore([
    {
      id: "A",
      type: "default",
      position: { x: 0, y: 0 },
      data: { label: "A" },
    },
    {
      id: "B",
      type: "default",
      position: { x: 0, y: 100 },
      data: { label: "B" },
    },
  ]);

  const [edges] = createEdgeStore([{ id: "ab", source: "A", target: "B" }]);

  // Create a reactive viewport signal that starts with initial values
  const [viewport, setViewport] = createStore<Viewport>({
    x: 100,
    y: 100,
    zoom: 5,
  });

  const { fitView } = useSolidFlow();

  // Get the current viewport from the flow
  const flowViewport = useViewport();

  const updateViewport = () => {
    setViewport("x", (prev) => prev + 10);
  };

  return (
    <SolidFlow nodes={nodes} edges={edges} fitView viewport={viewport}>
      <Controls />
      <Background variant="dots" />

      <Panel position="top-left">
        <button
          onClick={updateViewport}
          style={{
            padding: "8px 16px",
            margin: "4px",
            background: "#1a192b",
            color: "white",
            border: "none",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          Update viewport
        </button>
        <button
          onClick={() => fitView()}
          style={{
            padding: "8px 16px",
            margin: "4px",
            background: "#1a192b",
            color: "white",
            border: "none",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          FitView
        </button>
      </Panel>

      <Panel position="bottom-right">
        <div
          style={{
            padding: "12px",
            background: "rgba(255, 255, 255, 0.9)",
            "border-radius": "4px",
            "font-family": "monospace",
            "font-size": "12px",
          }}
        >
          <div style={{ "font-weight": "bold", "margin-bottom": "8px" }}>Viewport Debug:</div>
          <div>
            User: x: {viewport.x.toFixed(1)}, y: {viewport.y.toFixed(1)}, zoom:{" "}
            {viewport.zoom.toFixed(1)}
          </div>
          <div>
            Flow: x: {flowViewport().x.toFixed(1)}, y: {flowViewport().y.toFixed(1)}, zoom:{" "}
            {flowViewport().zoom.toFixed(1)}
          </div>
        </div>
      </Panel>
    </SolidFlow>
  );
};
