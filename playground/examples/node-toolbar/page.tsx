import {
  Background,
  createEdgeStore,
  createNodeStore,
  type NodeTypes,
  Position,
  SolidFlow,
} from "~/index";

import { CustomNode, type CustomNodeData } from "./CustomNode";
import { SelectedNodesToolbar } from "./SelectedNodesToolbar";

export function NodeToolbar() {
  const nodeTypes = {
    custom: CustomNode,
  } satisfies NodeTypes;

  const positions = ["top", "right", "bottom", "left"];
  const alignments: ("start" | "center" | "end")[] = ["start", "center", "end"];

  const initialNodes: Array<{
    id: string;
    type: "custom";
    data: CustomNodeData;
    position: { x: number; y: number };
    className?: string;
  }> = [
    {
      id: "default-node",
      type: "custom" as const,
      data: { label: "toolbar top", toolbarPosition: Position.Top },
      position: { x: 0, y: -200 },
      className: "solid-flow__node-default",
    },
  ];

  positions.forEach((position, posIndex) => {
    alignments.forEach((align, alignIndex) => {
      const id = `node-${align}-${position}`;
      initialNodes.push({
        id,
        type: "custom" as const,
        data: {
          label: `toolbar ${position} ${align}`,
          toolbarPosition: position as Position,
          toolbarAlign: align,
          toolbarVisible: true,
        },
        className: "solid-flow__node-default",
        position: { x: posIndex * 300, y: alignIndex * 100 },
      });
    });
  });

  const [nodes] = createNodeStore<typeof nodeTypes>(initialNodes);
  const [edges] = createEdgeStore([]);

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <SelectedNodesToolbar />
      </SolidFlow>
    </div>
  );
}
