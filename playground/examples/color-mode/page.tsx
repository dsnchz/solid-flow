import { type ColorMode } from "@xyflow/system";
import { createSignal } from "solid-js";

import { Background, Controls, MiniMap, Panel, SolidFlow } from "@/index";
import type { Edge, Node } from "@/types";

const initialNodes: Node[] = [
  {
    id: "A",
    type: "default",
    position: { x: 0, y: 0 },
    data: { label: "Node A" },
  },
  {
    id: "B",
    type: "default",
    position: { x: -100, y: 100 },
    data: { label: "Node B" },
  },
  {
    id: "C",
    type: "default",
    position: { x: 100, y: 100 },
    data: { label: "Node C" },
  },
  {
    id: "D",
    type: "default",
    position: { x: 0, y: 200 },
    data: { label: "Node D" },
  },
];

const initialEdges: Edge[] = [
  {
    id: "A-B",
    source: "A",
    target: "B",
  },
  {
    id: "A-C",
    source: "A",
    target: "C",
  },
  {
    id: "B-D",
    source: "B",
    target: "D",
  },
  {
    id: "C-D",
    source: "C",
    target: "D",
  },
];

export function ColorMode() {
  const [nodes] = createSignal(initialNodes);
  const [edges] = createSignal(initialEdges);
  const [colorMode, setColorMode] = createSignal<ColorMode>("light");

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <SolidFlow
        nodes={nodes()}
        edges={edges()}
        colorMode={colorMode()}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
      >
        <Background variant="dots" />
        <Controls />
        <MiniMap />
        <Panel position="top-right">
          <label>
            Color mode:
            <select
              value={colorMode()}
              onChange={(e) => setColorMode(e.target.value as ColorMode)}
              style={{ "margin-left": "8px" }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        </Panel>
      </SolidFlow>
    </div>
  );
}
