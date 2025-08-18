import dagre from "@dagrejs/dagre";
import { ConnectionLineType, Position } from "@xyflow/system";

import { Background, createEdgeStore, createNodeStore, Panel, SolidFlow } from "@/index";

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

export const Dagre = () => {
  const [nodes, setNodes] = createNodeStore([
    {
      id: "1",
      type: "input",
      data: { label: "input" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2",
      data: { label: "node 2" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2a",
      data: { label: "node 2a" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2b",
      data: { label: "node 2b" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2c",
      data: { label: "node 2c" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2d",
      data: { label: "node 2d" },
      position: { x: 0, y: 0 },
    },
    {
      id: "3",
      data: { label: "node 3" },
      position: { x: 0, y: 0 },
    },
    {
      id: "4",
      data: { label: "node 4" },
      position: { x: 0, y: 0 },
    },
    {
      id: "5",
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
  ]);

  const [edges, setEdges] = createEdgeStore([
    { id: "e12", source: "1", target: "2", type: "smoothstep", animated: true },
    { id: "e13", source: "1", target: "3", type: "smoothstep", animated: true },
    { id: "e22a", source: "2", target: "2a", type: "smoothstep", animated: true },
    { id: "e22b", source: "2", target: "2b", type: "smoothstep", animated: true },
    { id: "e22c", source: "2", target: "2c", type: "smoothstep", animated: true },
    { id: "e2c2d", source: "2c", target: "2d", type: "smoothstep", animated: true },
    { id: "e45", source: "4", target: "5", type: "smoothstep", animated: true },
    { id: "e56", source: "5", target: "6", type: "smoothstep", animated: true },
    { id: "e57", source: "5", target: "7", type: "smoothstep", animated: true },
  ]);

  const getLayoutedElements = (direction = "TB") => {
    const isHorizontal = direction === "LR";
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
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

    return { nodes: layoutedNodes, edges };
  };

  // Apply initial layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements("TB");

  // Update the stores with layouted elements
  setNodes(layoutedNodes);
  setEdges(layoutedEdges);

  const onLayout = (direction: string) => {
    const { nodes: newNodes, edges: newEdges } = getLayoutedElements(direction);
    setNodes(newNodes);
    setEdges(newEdges);
  };

  return (
    <div style={{ height: "100vh" }}>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        fitView
        connectionLineType={ConnectionLineType.SmoothStep}
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
