import { type Component, createSignal } from "solid-js";

import { createEdgeStore, createNodeStore, SolidFlow, SolidFlowProvider } from "../../../src";

const [nodesA] = createNodeStore([
  {
    id: "1a",
    type: "input",
    data: { label: "Node 1" },
    position: { x: 250, y: 5 },
    class: "light",
    ariaLabel: "Input Node 1",
  },
  {
    id: "2a",
    type: "default",
    data: { label: "Node 2" },
    position: { x: 100, y: 100 },
    class: "light",
    ariaLabel: "Default Node 2",
  },
  {
    id: "3a",
    type: "default",
    data: { label: "Node 3" },
    position: { x: 400, y: 100 },
    class: "light",
  },
]);

const [edgesA] = createEdgeStore([
  { id: "e1-2", source: "1a", target: "2a" },
  { id: "e1-3", source: "1a", target: "3a" },
]);

const [nodesB] = createNodeStore([
  {
    id: "inputb",
    type: "input",
    data: { label: "Input" },
    position: { x: 300, y: 5 },
    class: "light",
    ariaLabel: "Input Node",
  },
  {
    id: "1b",
    type: "default",
    data: { label: "Node 1" },
    position: { x: 0, y: 100 },
    class: "light",
    ariaLabel: "Node with id 1",
  },
  {
    id: "2b",
    type: "default",
    data: { label: "Node 2" },
    position: { x: 200, y: 100 },
    class: "light",
    ariaLabel: "Node with id 2",
  },
  {
    id: "3b",
    type: "default",
    data: { label: "Node 3" },
    position: { x: 400, y: 100 },
    class: "light",
  },
  {
    id: "4b",
    type: "default",
    data: { label: "Node 4" },
    position: { x: 600, y: 100 },
    class: "light",
  },
]);

const [edgesB] = createEdgeStore([
  { id: "e1b", source: "inputb", target: "1b", ariaLabel: "edge to connect" },
  { id: "e2b", source: "inputb", target: "2b" },
  { id: "e3b", source: "inputb", target: "3b" },
  { id: "e4b", source: "inputb", target: "4b" },
]);

const SwitchFlow: Component = () => {
  const [nodes, setNodes] = createSignal(nodesA);
  const [edges, setEdges] = createSignal(edgesA);

  return (
    <SolidFlow nodes={nodes()} edges={edges()} nodeDragThreshold={10}>
      <div
        style={{
          position: "absolute",
          right: "10px",
          top: "10px",
          "z-index": "4",
        }}
      >
        <button
          onClick={() => {
            setNodes(nodesA);
            setEdges(edgesA);
          }}
          style={{ "margin-right": "5px" }}
        >
          flow a
        </button>
        <button
          onClick={() => {
            setNodes(nodesB);
            setEdges(edgesB);
          }}
        >
          flow b
        </button>
      </div>
    </SolidFlow>
  );
};

export const Switch: Component = () => (
  <SolidFlowProvider>
    <SwitchFlow />
  </SolidFlowProvider>
);
