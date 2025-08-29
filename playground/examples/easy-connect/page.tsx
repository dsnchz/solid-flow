import "./style.css";

import {
  Background,
  createEdgeStore,
  createNodeStore,
  MarkerType,
  type NodeTypes,
  SolidFlow,
} from "~/index";

import CustomConnectionLine from "./CustomConnectionLine";
import CustomNode from "./CustomNode";
import FloatingEdge from "./FloatingEdge";

const nodeTypes = {
  custom: CustomNode,
} satisfies NodeTypes;

const edgeTypes = {
  floating: FloatingEdge,
};

const defaultEdgeOptions = {
  style: { "stroke-width": "3px", stroke: "black" },
  type: "floating",
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "black",
  },
};

const connectionLineStyle = {
  "stroke-width": "3px",
  stroke: "black",
};

export const EasyConnect = () => {
  const [nodes] = createNodeStore<typeof nodeTypes>([
    {
      id: "1",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {},
    },
    {
      id: "2",
      type: "custom",
      position: { x: 250, y: 320 },
      data: {},
    },
    {
      id: "3",
      type: "custom",
      position: { x: 40, y: 300 },
      data: {},
    },
    {
      id: "4",
      type: "custom",
      position: { x: 300, y: 0 },
      data: {},
    },
  ]);

  const [edges] = createEdgeStore([]);

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      // onConnect={onConnect}
      fitView
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      connectionLineComponent={CustomConnectionLine}
      connectionLineStyle={connectionLineStyle}
    >
      <Background />
    </SolidFlow>
  );
};
