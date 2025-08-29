import type { Connection } from "@xyflow/system";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  type Edge,
  type EdgeTypes,
  MiniMap,
  type Node,
  SolidFlow,
} from "@/index";

import { ButtonEdge } from "./ButtonEdge";
import { CustomEdge } from "./CustomEdge";
import { CustomEdge2 } from "./CustomEdge2";
import { CustomEdge3 } from "./CustomEdge3";

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
  custom2: CustomEdge2,
  custom3: CustomEdge3,
  button: ButtonEdge, // Keep existing button edge for compatibility
};

export function Edges() {
  const [nodes] = createNodeStore([
    {
      id: "1",
      type: "input",
      data: { label: "Input 1" },
      position: { x: 250, y: 0 },
    },
    { id: "2", type: "default", data: { label: "Node 2" }, position: { x: 150, y: 100 } },
    { id: "2a", type: "default", data: { label: "Node 2a" }, position: { x: 0, y: 180 } },
    { id: "2b", type: "default", data: { label: "Node 2b" }, position: { x: -40, y: 300 } },
    { id: "3", type: "default", data: { label: "Node 3" }, position: { x: 250, y: 200 } },
    { id: "4", type: "default", data: { label: "Node 4" }, position: { x: 400, y: 300 } },
    { id: "3a", type: "default", data: { label: "Node 3a" }, position: { x: 150, y: 300 } },
    { id: "5", type: "default", data: { label: "Node 5" }, position: { x: 250, y: 400 } },
    {
      id: "6",
      type: "output",
      data: { label: "Output 6" },
      position: { x: 50, y: 550 },
    },
    {
      id: "7",
      type: "output",
      data: { label: "Output 7" },
      position: { x: 250, y: 550 },
    },
    {
      id: "8",
      type: "output",
      data: { label: "Output 8" },
      position: { x: 525, y: 600 },
    },
    {
      id: "9",
      type: "output",
      data: { label: "Output 9" },
      position: { x: 675, y: 500 },
    },
    {
      id: "10",
      type: "output",
      data: { label: "Output 10" },
      position: { x: 50, y: 400 },
    },
    {
      id: "11",
      type: "output",
      data: { label: "Output 11" },
      position: { x: 825, y: 400 },
    },
    {
      id: "12",
      type: "output",
      data: { label: "Output 12" },
      position: { x: 825, y: 300 },
    },
    {
      id: "13",
      type: "output",
      data: { label: "Output 13" },
      position: { x: 900, y: 200 },
    },
    {
      id: "14",
      type: "output",
      data: { label: "Output 14" },
      position: { x: 825, y: 100 },
    },
  ]);

  const [edges] = createEdgeStore<typeof edgeTypes>([
    {
      id: "e1-2",
      source: "1",
      target: "2",
      label: "bezier edge (default)",
      class: "normal-edge",
    },
    {
      id: "e2-2a",
      source: "2",
      target: "2a",
      type: "smoothstep",
      label: "smoothstep edge",
    },
    {
      id: "e2a-2b",
      source: "2a",
      target: "2b",
      type: "default", // Note: simplebezier not available in Solid Flow
      label: "simple bezier edge",
    },
    {
      id: "e2-3",
      source: "2",
      target: "3",
      type: "step",
      label: "step edge",
    },
    {
      id: "e3-4",
      source: "3",
      target: "4",
      type: "straight",
      label: "straight edge",
    },
    {
      id: "e3-3a",
      source: "3",
      target: "3a",
      type: "straight",
      label: "label only edge",
      style: { stroke: "none" },
    },
    {
      id: "e3-5",
      source: "4",
      target: "5",
      animated: true,
      label: "animated styled edge",
      style: { stroke: "red" },
    },
    {
      id: "e5-7",
      source: "5",
      target: "7",
      label: "label with styled bg",
      labelStyle: {
        background: "rgba(255, 204, 0, 0.7)",
        padding: "4px 8px",
        "border-radius": "4px",
      },
      markerEnd: {
        type: "arrowclosed",
      },
    },
    {
      id: "e5-8",
      source: "5",
      target: "8",
      type: "custom",
      data: { text: "custom edge" },
    },
    {
      id: "e5-9",
      source: "5",
      target: "9",
      type: "custom2",
      data: { text: "custom edge 2" },
    },
    {
      id: "e3a-10",
      source: "3a",
      target: "10",
      type: "custom3",
      data: { text: "custom edge 3" },
    },
    {
      id: "e5-6",
      source: "5",
      target: "6",
      label: "i am using <tspan>", // Simplified since Solid Flow doesn't support JSX in labels
      labelStyle: { color: "red", "font-weight": "700" },
      style: { stroke: "#ffcc00" },
      markerEnd: {
        type: "arrow",
        color: "#FFCC00",
        width: 20,
        height: 20,
      },
      markerStart: {
        type: "arrowclosed",
        color: "#FFCC00",
        width: 20,
        height: 20,
      },
    },
    {
      id: "e4-11",
      source: "4",
      target: "11",
      label: "Explicit Blue Prop Color (should override CSS)",
      class: "css-variable-edge",
      markerEnd: {
        type: "arrowclosed",
        color: "#0000ff",
        width: 40,
        height: 40,
      },
    },
    {
      id: "e4-12",
      source: "4",
      target: "12",
      label: "Marker explicitly undefined Color (defaults to none)",
      class: "css-variable-edge",
      markerEnd: {
        type: "arrowclosed",
        color: undefined,
        width: 40,
        height: 40,
      },
    },
    {
      id: "e4-13",
      source: "4",
      target: "13",
      label: "Marker null Color (should use `--xy-edge-stroke` CSS variable)",
      class: "css-variable-edge",
      markerEnd: {
        type: "arrowclosed",
        color: null,
        width: 40,
        height: 40,
      },
    },
    {
      id: "e4-14",
      source: "4",
      target: "14",
      label: "Marker implicitly undefined Color (defaults to defaultMarkerColor)",
      class: "css-variable-edge",
      markerEnd: {
        type: "arrowclosed",
        width: 40,
        height: 40,
      },
    },
  ]);

  const onConnect = (connection: Connection) => {
    console.log("New connection:", connection);
    // Add edge logic would go here
  };

  const onNodeClick = ({ node }: { node: Node }) => console.log("click", node);
  const onEdgeClick = ({ edge }: { edge: Edge }) => console.log("click", edge);
  const onEdgePointerEnter = ({ edge }: { edge: Edge }) => console.log("enter", edge);
  const onEdgePointerLeave = ({ edge }: { edge: Edge }) => console.log("leave", edge);

  return (
    <>
      <style>{`
        /* Test CSS variables on specific edges - matching React Flow */
        .solid-flow {
          --xy-edge-stroke-width: 1;
          --xy-edge-stroke: #00ff00;
        }
      `}</style>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgePointerEnter={onEdgePointerEnter}
        onEdgePointerLeave={onEdgePointerLeave}
        defaultMarkerColor="purple"
        defaultEdgeOptions={{
          markerEnd: {
            type: "arrow",
            color: "red",
            width: 20,
            height: 20,
          },
        }}
        fitView
        snapGrid={[10, 10]}
      >
        <MiniMap />
        <Controls />
        <Background />
      </SolidFlow>
    </>
  );
}
