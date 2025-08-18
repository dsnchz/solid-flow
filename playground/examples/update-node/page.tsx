import { Position } from "@xyflow/system";
import { createSignal } from "solid-js";
import { produce } from "solid-js/store";

import { createEdgeStore, createNodeStore, Handle, Panel, SolidFlow, useSolidFlow } from "@/index";
import type { NodeProps, NodeTypes } from "@/types";

// Custom Node Components
const ProcessNode = (props: NodeProps<{ label: string }, "process">) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          background: "#e3f2fd",
          border: "2px solid #1976d2",
          "border-radius": "8px",
          padding: "10px 15px",
          color: "#1976d2",
          "font-weight": "600",
        }}
      >
        {props.data.label}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
};

const TaskNode = (props: NodeProps<{ label: string }, "task">) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          background: "#f3e5f5",
          border: "2px solid #7b1fa2",
          "border-radius": "8px",
          padding: "10px 15px",
          color: "#7b1fa2",
          "font-weight": "600",
        }}
      >
        {props.data.label}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
};

const nodeTypes = {
  process: ProcessNode,
  task: TaskNode,
} satisfies NodeTypes;

export const UpdateNode = () => {
  // Form state
  const [nodeLabel, setNodeLabel] = createSignal("Process Node");
  const [nodeBackground, setNodeBackground] = createSignal("#e3f2fd");
  const [nodeHidden, setNodeHidden] = createSignal(false);

  const [nodes, setNodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "input",
      sourcePosition: Position.Right,
      data: { label: "Input" },
      position: { x: 0, y: 80 },
    },
    {
      id: "2",
      type: "process",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { label: "Process Node" },
      position: { x: 250, y: 0 },
      style: { "background-color": "#e3f2fd" },
    },
  ]);

  const [edges, setEdges] = createEdgeStore([
    {
      id: "e1-2",
      source: "1",
      type: "smoothstep",
      target: "2",
      animated: true,
    },
  ]);

  const solidFlow = useSolidFlow();

  // Define the cycle of node types
  const nodeTypeCycle = ["process", "task", "default", "output"] as const;

  // Update functions
  const updateLabel = () => {
    const newLabel = nodeLabel();
    setNodes(
      (node) => node.id === "2",
      produce((node) => {
        node.data.label = newLabel;
      }),
    );
  };

  const updateBackground = () => {
    const newBg = nodeBackground();
    setNodes(
      (node) => node.id === "2",
      produce((node) => {
        node.style = { ...node.style, "background-color": newBg };
      }),
    );
  };

  const updateVisibility = () => {
    const hidden = nodeHidden();

    setNodes(
      (node) => node.id === "2",
      produce((node) => {
        node.hidden = hidden;
      }),
    );

    setEdges(
      (edge) => edge.id === "e1-2",
      produce((edge) => {
        edge.hidden = hidden;
      }),
    );
  };

  const updatePosition = () => {
    setNodes(
      (node) => node.id === "2",
      produce((node) => {
        node.position = {
          x: node.position.x + 10,
          y: node.position.y,
        };
      }),
    );
  };

  const changeType = () => {
    setNodes(
      (node) => node.id === "2",
      produce((node) => {
        const currentIndex = nodeTypeCycle.indexOf(
          node.type as Exclude<typeof node.type, "input" | "group">,
        );
        const nextIndex = (currentIndex + 1) % nodeTypeCycle.length;
        const nextType = nodeTypeCycle[nextIndex]!;

        const typeLabels = {
          process: "Process Node",
          task: "Task Node",
          default: "Default Node",
          output: "Output Node",
        };

        node.type = nextType;
        node.data.label = typeLabels[nextType]!;
        setNodeLabel(typeLabels[nextType]!);

        // Reset background color based on type
        const typeColors = {
          process: "#e3f2fd",
          task: "#f3e5f5",
          default: "#ffffff",
          output: "#e8f5e8",
        };
        const newColor = typeColors[nextType]!;
        node.style = { ...node.style, "background-color": newColor };
        setNodeBackground(newColor);
      }),
    );
  };

  const fitView = () => {
    void solidFlow?.fitView();
  };

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Panel position="top-right">
          <div
            style={{
              padding: "16px",
              background: "rgba(255, 255, 255, 0.9)",
              "border-radius": "8px",
              "font-family": "system-ui, sans-serif",
              "min-width": "250px",
              display: "flex",
              "flex-direction": "column",
              gap: "12px",
            }}
          >
            <div style={{ "font-weight": "bold", "font-size": "16px", "margin-bottom": "4px" }}>
              Update Node Controls
            </div>

            {/* Label Control */}
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <label style={{ "font-weight": "500", "font-size": "14px" }}>Label:</label>
              <input
                type="text"
                value={nodeLabel()}
                onInput={(e) => setNodeLabel(e.currentTarget.value)}
                onBlur={updateLabel}
                style={{
                  padding: "8px",
                  border: "1px solid #ccc",
                  "border-radius": "4px",
                  "font-size": "14px",
                }}
              />
            </div>

            {/* Background Color Control */}
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <label style={{ "font-weight": "500", "font-size": "14px" }}>Background:</label>
              <input
                type="color"
                value={nodeBackground()}
                onInput={(e) => setNodeBackground(e.currentTarget.value)}
                onChange={updateBackground}
                style={{
                  padding: "4px",
                  border: "1px solid #ccc",
                  "border-radius": "4px",
                  height: "40px",
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Visibility Control */}
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={nodeHidden()}
                onChange={(e) => {
                  setNodeHidden(e.currentTarget.checked);
                  updateVisibility();
                }}
                style={{ cursor: "pointer" }}
              />
              <label style={{ "font-weight": "500", "font-size": "14px", cursor: "pointer" }}>
                Hidden
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
              <button
                onClick={updatePosition}
                style={{
                  padding: "8px 12px",
                  background: "#1976d2",
                  color: "white",
                  border: "none",
                  "border-radius": "4px",
                  cursor: "pointer",
                  "font-size": "14px",
                }}
              >
                Move Right (+10px)
              </button>

              <button
                onClick={changeType}
                style={{
                  padding: "8px 12px",
                  background: "#7b1fa2",
                  color: "white",
                  border: "none",
                  "border-radius": "4px",
                  cursor: "pointer",
                  "font-size": "14px",
                }}
              >
                Change Type
              </button>

              <button
                onClick={fitView}
                style={{
                  padding: "8px 12px",
                  background: "#2e7d32",
                  color: "white",
                  border: "none",
                  "border-radius": "4px",
                  cursor: "pointer",
                  "font-size": "14px",
                }}
              >
                Fit View
              </button>
            </div>
          </div>
        </Panel>
      </SolidFlow>
    </div>
  );
};
