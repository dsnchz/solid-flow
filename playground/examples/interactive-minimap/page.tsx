import { type Component, createSignal } from "solid-js";

import {
  Background,
  Controls,
  createNodeStore,
  MiniMap,
  SolidFlow,
  SolidFlowProvider,
  useSolidFlow,
} from "../../../src";

const defaultEdgeOptions = { zIndex: 0 };

const InteractiveMinimapFlow: Component = () => {
  const { toObject, setViewport } = useSolidFlow();
  const [inverse, setInverse] = createSignal(false);
  const [nodes, setNodes] = createNodeStore([
    {
      id: "1",
      type: "default",
      data: { label: "Node 1" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2",
      type: "default",
      data: { label: "Node 2" },
      position: { x: 0, y: 200 },
    },
    {
      id: "3",
      type: "default",
      data: { label: "Node 3" },
      position: { x: 200, y: 0 },
    },
    {
      id: "4",
      type: "default",
      data: { label: "Node 4" },
      position: { x: 1000, y: 0 },
    },
    {
      id: "5",
      type: "default",
      data: { label: "Node 5" },
      position: { x: 1000, y: 200 },
    },
    {
      id: "6",
      type: "default",
      data: { label: "Node 6" },
      position: { x: 800, y: 0 },
    },
    {
      id: "7",
      type: "default",
      data: { label: "Node 7" },
      position: { x: 0, y: 1000 },
    },
    {
      id: "8",
      type: "default",
      data: { label: "Node 8" },
      position: { x: 0, y: 800 },
    },
    {
      id: "9",
      type: "default",
      data: { label: "Node 9" },
      position: { x: 200, y: 1000 },
    },
    {
      id: "10",
      type: "default",
      data: { label: "Node 10" },
      position: { x: 1000, y: 1000 },
    },
    {
      id: "11",
      type: "default",
      data: { label: "Node 11" },
      position: { x: 800, y: 1000 },
    },
    {
      id: "12",
      type: "default",
      data: { label: "Node 12" },
      position: { x: 1000, y: 800 },
    },
  ]);

  const updatePos = () => {
    setNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        position: {
          x: Math.random() * 400,
          y: Math.random() * 400,
        },
      })),
    );
  };

  const logToObject = () => console.log(toObject());
  const resetTransform = () => setViewport({ x: 0, y: 0, zoom: 1 });
  const toggleInverse = () => setInverse(!inverse());

  const toggleClassnames = () => {
    setNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        class: node.class === "light" ? "dark" : "light",
      })),
    );
  };

  return (
    <>
      <style>{`
        .light {
          background: #fff;
          border: 1px solid #ddd;
          color: #333;
        }
        
        .dark {
          background: #333;
          border: 1px solid #666;
          color: #fff;
        }
      `}</style>
      <SolidFlow
        nodes={nodes}
        minZoom={0.2}
        maxZoom={4}
        defaultEdgeOptions={defaultEdgeOptions}
        selectNodesOnDrag={false}
        fitView
      >
        <Background variant="dots" />
        <MiniMap pannable zoomable inversePan={inverse()} />
        <Controls />

        <div
          style={{
            position: "absolute",
            right: "10px",
            top: "10px",
            "z-index": "4",
          }}
        >
          <button onClick={resetTransform} style={{ "margin-right": "5px" }}>
            reset transform
          </button>
          <button onClick={updatePos} style={{ "margin-right": "5px" }}>
            change pos
          </button>
          <button onClick={toggleClassnames} style={{ "margin-right": "5px" }}>
            toggle classnames
          </button>
          <button onClick={logToObject} style={{ "margin-right": "5px" }}>
            toObject
          </button>
          <button onClick={toggleInverse} style={{ "margin-right": "5px" }}>
            {inverse() ? "un-inverse pan" : "inverse pan"}
          </button>
        </div>
      </SolidFlow>
    </>
  );
};

export const InteractiveMinimap: Component = () => (
  <SolidFlowProvider>
    <InteractiveMinimapFlow />
  </SolidFlowProvider>
);
