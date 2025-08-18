import { type Connection, Position } from "@xyflow/system";
import { produce } from "solid-js/store";

import { createEdgeStore, createNodeStore, Handle, SolidFlow } from "@/index";
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

const buttonStyle = {
  position: "absolute" as const,
  right: "10px",
  top: "30px",
  "z-index": 4,
};

export const NodeTypeChange = () => {
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

  const onConnect = (connection: Connection) => {
    setEdges((eds) => [...eds, { ...connection, id: `e${eds.length + 1}` }]);
  };

  // Define the cycle of node types (excluding input)
  const nodeTypeCycle = ["process", "task", "default", "output"] as const;

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
      }),
    );
  };

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow nodes={nodes} edges={edges} onConnect={onConnect} nodeTypes={nodeTypes} fitView>
        <button onClick={changeType} style={buttonStyle}>
          change type
        </button>
      </SolidFlow>
    </div>
  );
};
