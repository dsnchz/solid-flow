import dagre from "@dagrejs/dagre";

import {
  Background,
  createEdgeStore,
  createNodeStore,
  type SolidFlowEdge,
  type SolidFlowNode,
  Panel,
  Position,
  SolidFlow,
} from "@/index";

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

type LayoutInput = {
  readonly id: string;
  readonly source?: string;
  readonly target?: string;
};

/**
 * Pure dagre pass over plain arrays: dagre only needs ids, structure, and
 * the constant node dimensions, so the initial layout runs BEFORE the
 * stores are seeded. (Writing the layout back via setNodes during component
 * setup trips Solid 2.0's REACTIVE_WRITE_IN_OWNED_SCOPE guard — reactive
 * writes are for event handlers, not component bodies.)
 */
const layoutNodes = <T extends LayoutInput>(
  nodeList: readonly T[],
  edgeList: readonly LayoutInput[],
  direction: "TB" | "LR",
) => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodeList.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  edgeList.forEach((edge) => {
    dagreGraph.setEdge(edge.source!, edge.target!);
  });

  dagre.layout(dagreGraph);

  return nodeList.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
};

const initialNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "input" },
    position: { x: 0, y: 0 },
  },
  {
    id: "2",
    type: "default",
    data: { label: "node 2" },
    position: { x: 0, y: 0 },
  },
  {
    id: "2a",
    type: "default",
    data: { label: "node 2a" },
    position: { x: 0, y: 0 },
  },
  {
    id: "2b",
    type: "default",
    data: { label: "node 2b" },
    position: { x: 0, y: 0 },
  },
  {
    id: "2c",
    type: "default",
    data: { label: "node 2c" },
    position: { x: 0, y: 0 },
  },
  {
    id: "2d",
    type: "default",
    data: { label: "node 2d" },
    position: { x: 0, y: 0 },
  },
  {
    id: "3",
    type: "default",
    data: { label: "node 3" },
    position: { x: 0, y: 0 },
  },
  {
    id: "4",
    type: "default",
    data: { label: "node 4" },
    position: { x: 0, y: 0 },
  },
  {
    id: "5",
    type: "default",
    data: { label: "node 5" },
    position: { x: 0, y: 0 },
  },
  {
    id: "6",
    type: "output",
    data: { label: "output" },
    position: { x: 0, y: 0 },
  },
  {
    id: "7",
    type: "output",
    data: { label: "output" },
    position: { x: 0, y: 0 },
  },
] satisfies SolidFlowNode[];

const initialEdges = [
  { id: "e12", source: "1", target: "2", type: "smoothstep", animated: true },
  { id: "e13", source: "1", target: "3", type: "smoothstep", animated: true },
  { id: "e22a", source: "2", target: "2a", type: "smoothstep", animated: true },
  { id: "e22b", source: "2", target: "2b", type: "smoothstep", animated: true },
  { id: "e22c", source: "2", target: "2c", type: "smoothstep", animated: true },
  { id: "e2c2d", source: "2c", target: "2d", type: "smoothstep", animated: true },
  { id: "e45", source: "4", target: "5", type: "smoothstep", animated: true },
  { id: "e56", source: "5", target: "6", type: "smoothstep", animated: true },
  { id: "e57", source: "5", target: "7", type: "smoothstep", animated: true },
] satisfies SolidFlowEdge[];

export const Dagre = () => {
  // Seed the stores with the layout already applied — no setup-time writes.
  const [nodes, setNodes] = createNodeStore(layoutNodes(initialNodes, initialEdges, "TB"));
  const [edges] = createEdgeStore(initialEdges);

  const onLayout = (direction: "TB" | "LR") => {
    // Event handler: reading the stores and writing the result back is fine.
    setNodes(() => layoutNodes(nodes, edges, direction));
  };

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        fitView
        connectionLineType={"smoothstep"}
        defaultEdgeOptions={{ type: "smoothstep", animated: true }}
      >
        <Panel position="top-right">
          <button
            onClick={() => onLayout("TB")}
            style={{
              padding: "8px 16px",
              margin: "4px",
              background: "#1a192b",
              color: "white",
              border: "none",
              "border-radius": "4px",
              cursor: "pointer",
            }}
          >
            vertical layout
          </button>
          <button
            onClick={() => onLayout("LR")}
            style={{
              padding: "8px 16px",
              margin: "4px",
              background: "#1a192b",
              color: "white",
              border: "none",
              "border-radius": "4px",
              cursor: "pointer",
            }}
          >
            horizontal layout
          </button>
        </Panel>
        <Background />
      </SolidFlow>
    </div>
  );
};
