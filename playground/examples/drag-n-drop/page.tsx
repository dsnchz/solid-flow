import {
  Background,
  type BuiltInNodeTypes,
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  SolidFlow,
  useSolidFlow,
} from "@/index";

import { Sidebar } from "./Sidebar";

export function DragNDrop() {
  const { screenToFlowPosition, addNodes } = useSolidFlow();

  const [nodes] = createNodeStore([
    {
      id: "1",
      type: "input",
      data: { label: "Input Node" },
      position: { x: 150, y: 5 },
    },
    {
      id: "2",
      type: "default",
      data: { label: "Node" },
      position: { x: 0, y: 150 },
    },
    {
      id: "3",
      type: "output",
      data: { label: "Output Node" },
      position: { x: 300, y: 150 },
    },
  ]);

  const [edges] = createEdgeStore([
    {
      id: "1-2",
      type: "default",
      source: "1",
      target: "2",
      label: "Edge Text",
    },
    {
      id: "1-3",
      type: "smoothstep",
      source: "1",
      target: "3",
    },
  ]);

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();

    if (!event.dataTransfer) {
      return null;
    }

    const type =
      (event.dataTransfer.getData("application/solidflow") as Exclude<
        keyof BuiltInNodeTypes,
        "group"
      >) || "default";

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${Math.random()}`,
      type,
      position,
      data: { label: `${type} node` },
    };

    addNodes(newNode);
  };

  return (
    <main style={{ height: "100%", display: "flex" }}>
      <SolidFlow nodes={nodes} edges={edges} fitView onDragOver={onDragOver} onDrop={onDrop}>
        <Controls />
        <Background variant="dots" />
        <MiniMap />
      </SolidFlow>
      <Sidebar />
    </main>
  );
}
