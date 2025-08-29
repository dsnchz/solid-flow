import { createSignal } from "solid-js";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  Panel,
  SolidFlow,
} from "~/index";

export const A11y = () => {
  const [nodes] = createNodeStore([
    {
      id: "A",
      type: "input",
      position: { x: 0, y: 0 },
      data: { label: "A" },
    },
    {
      id: "B",
      type: "output",
      position: { x: -100, y: 150 },
      data: { label: "B" },
    },
    {
      id: "C",
      type: "output",
      position: { x: 1000, y: 150 },
      data: { label: "C" },
    },
    {
      id: "D",
      type: "output",
      position: { x: 0, y: 260 },
      data: { label: "D" },
    },
  ]);

  const [edges] = createEdgeStore([
    { id: "A-B", source: "A", target: "B" },
    { id: "A-C", source: "A", target: "C" },
    { id: "A-D", source: "A", target: "D" },
  ]);

  const [autoPanOnNodeFocus, setAutoPanOnNodeFocus] = createSignal(true);

  const ariaLabelConfig = {
    "node.a11yDescription.default": "Solid Custom Node Desc.",
    "node.a11yDescription.keyboardDisabled": "Solid Custom Keyboard Desc.",
    "node.a11yDescription.ariaLiveMessage": ({
      direction,
      x,
      y,
    }: {
      direction: string;
      x: number;
      y: number;
    }) => `Custom Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
    "edge.a11yDescription.default": "Solid Custom Edge Desc.",
    "controls.ariaLabel": "Solid Custom Control Aria Label",
    "controls.zoomIn.ariaLabel": "Solid Custom Zoom in",
    "controls.zoomOut.ariaLabel": "Solid Custom Zoom Out",
    "controls.interactive.ariaLabel": "Solid Custom Toggle Interactivity",
    "minimap.ariaLabel": "Solid Custom Minimap",
  };

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      autoPanOnNodeFocus={autoPanOnNodeFocus()}
      ariaLabelConfig={ariaLabelConfig}
      fitView
    >
      <Controls />
      <Background />
      <MiniMap />
      <Panel position="top-right">
        <div>
          <label for="focusPannable">
            Enable Pan on Focus
            <input
              id="focusPannable"
              type="checkbox"
              checked={autoPanOnNodeFocus()}
              onChange={(e) => setAutoPanOnNodeFocus(e.currentTarget.checked)}
              class="solid-flow__zoomonscroll"
            />
          </label>
        </div>
      </Panel>
    </SolidFlow>
  );
};
