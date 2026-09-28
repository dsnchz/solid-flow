import { createSignal } from "solid-js";

import { Background, type ColorModeClass, Controls, MiniMap, Panel, SolidFlow } from "@/index";

export function ColorMode() {
  const [nodes] = createSignal([
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
  ]);

  const [edges] = createSignal([
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
  ]);

  // Unset follows the OS (CSS color-scheme); a value forces a scheme.
  const [colorMode, setColorMode] = createSignal<ColorModeClass | undefined>();

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <SolidFlow
        nodes={nodes()}
        edges={edges()}
        forceColorMode={colorMode()}
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
              value={colorMode() ?? ""}
              onChange={(e) =>
                setColorMode((e.target.value || undefined) as ColorModeClass | undefined)
              }
              style={{ "margin-left": "8px" }}
            >
              <option value="">System (OS)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </Panel>
      </SolidFlow>
    </div>
  );
}
