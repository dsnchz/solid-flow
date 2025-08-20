import type { Connection } from "@xyflow/system";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

import { Background, Controls, Panel, SolidFlow } from "@/components";
import { useInternalSolidFlow } from "@/components/contexts";
import { createNodeStore } from "@/index";

import { CustomResizerNode } from "./components/CustomResizer";
import { DefaultResizerNode } from "./components/DefaultResizer";
import { HorizontalResizerNode } from "./components/HorizontalResizer";
import { VerticalResizerNode } from "./components/VerticalResizer";

const nodeTypes = {
  defaultResizer: DefaultResizerNode,
  customResizer: CustomResizerNode,
  verticalResizer: VerticalResizerNode,
  horizontalResizer: HorizontalResizerNode,
};

const nodeStyle = {
  border: "1px solid #222",
  "font-size": "10px",
  "background-color": "#ddd",
};

export const NodeResizer = () => {
  const { actions } = useInternalSolidFlow();
  const [snapToGrid, setSnapToGrid] = createSignal(false);

  const [nodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "defaultResizer",
      data: { label: "default resizer" },
      position: { x: 0, y: 0 },
      origin: [1, 1],
      style: { ...nodeStyle },
    },
    {
      id: "1a",
      type: "defaultResizer",
      data: {
        label: "default resizer with min and max dimensions",
        minWidth: 100,
        minHeight: 80,
        maxWidth: 200,
        maxHeight: 200,
      },
      position: { x: 0, y: 60 },
      width: 100,
      height: 80,
      style: { ...nodeStyle },
    },
    {
      id: "1b",
      type: "defaultResizer",
      data: {
        label: "default resizer with initial size and aspect ratio",
        keepAspectRatio: true,
        minWidth: 100,
        minHeight: 60,
        maxWidth: 400,
        maxHeight: 400,
      },
      position: { x: 250, y: 0 },
      width: 174,
      height: 123,
      style: {
        ...nodeStyle,
      },
    },
    {
      id: "2",
      type: "customResizer",
      data: { label: "custom resize icon" },
      position: { x: 0, y: 200 },
      width: 100,
      height: 60,
      style: { ...nodeStyle },
    },
    {
      id: "3",
      type: "verticalResizer",
      data: { label: "vertical resizer" },
      position: { x: 250, y: 200 },
      style: { ...nodeStyle },
    },
    {
      id: "3a",
      type: "verticalResizer",
      data: {
        label: "vertical resizer with min/maxHeight and aspect ratio",
        minHeight: 50,
        maxHeight: 200,
        keepAspectRatio: true,
      },
      position: { x: 400, y: 200 },
      height: 50,
      style: { ...nodeStyle },
    },
    {
      id: "4",
      type: "horizontalResizer",
      data: {
        label: "horizontal resizer with aspect ratio",
        keepAspectRatio: true,
        minHeight: 20,
        maxHeight: 80,
        maxWidth: 300,
      },
      position: { x: 250, y: 300 },
      style: { ...nodeStyle },
    },
    {
      id: "4a",
      type: "horizontalResizer",
      data: { label: "horizontal resizer with maxWidth", maxWidth: 300 },
      position: { x: 250, y: 400 },
      style: { ...nodeStyle },
    },
    {
      id: "5",
      type: "defaultResizer",
      data: { label: "Parent", keepAspectRatio: true },
      position: { x: 700, y: 0 },
      width: 300,
      height: 300,
      style: { ...nodeStyle },
    },
    {
      id: "5a",
      type: "defaultResizer",
      data: {
        label: "Child with extent: parent",
      },
      position: { x: 50, y: 50 },
      parentId: "5",
      extent: "parent",
      width: 50,
      height: 100,
      style: { ...nodeStyle },
    },
    {
      id: "5b",
      type: "defaultResizer",
      data: { label: "Child with expandParent" },
      position: { x: 100, y: 100 },
      width: 100,
      height: 100,
      parentId: "5",
      expandParent: true,
      style: { ...nodeStyle },
    },
    {
      id: "5b",
      type: "defaultResizer",
      data: { label: "Child without extent" },
      position: { x: 250, y: 200 },
      height: 100,
      width: 100,
      parentId: "5",
      style: { ...nodeStyle },
    },
  ]);

  const [edges] = createStore([]);

  const onConnect = (connection: Connection) => {
    if (connection) actions.addEdge(connection);
  };

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      minZoom={0.2}
      maxZoom={5}
      snapGrid={snapToGrid() ? [10, 10] : undefined}
      nodeOrigin={[0.5, 0.5]}
      fitView
    >
      <Controls />
      <Background variant="lines" />
      <Panel position="bottom-right">
        <button onClick={() => setSnapToGrid((s) => !s)}>
          snapToGrid: {snapToGrid() ? "on" : "off"}
        </button>
      </Panel>
    </SolidFlow>
  );
};
