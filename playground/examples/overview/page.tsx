import { produce } from "solid-js/store";

import {
  Background,
  ControlButton,
  Controls,
  createEdgeStore,
  createNodeStore,
  EdgeLabel,
  type EdgeProps,
  getBezierPath,
  Handle,
  MiniMap,
  type NodeProps,
  Panel,
  Position,
  SolidFlow,
  useSolidFlow,
} from "@/index";

// Custom Node Component
const CustomNode = (props: NodeProps<{ label: string }, "custom">) => {
  return (
    <div
      style={{
        background: "#ffcc00",
        padding: "10px",
      }}
    >
      <div>{props.data.label}</div>
      <div>
        {Math.round(props.positionAbsoluteX ?? 0)}, {Math.round(props.positionAbsoluteY ?? 0)}
      </div>

      <Handle type="target" position="top" />

      <Handle type="source" position="bottom" style={{ left: "10%" }} id="a" />
      <Handle type="source" position="bottom" id="b" />
      <Handle type="source" position="bottom" style={{ left: "90%" }} id="c" />
    </div>
  );
};

// Custom Node with Drag Handle
const CustomNodeDragHandle = (props: NodeProps<{ label: string }, "dragHandle">) => {
  return (
    <div
      style={{
        background: "white",
        padding: "10px",
      }}
    >
      <div>{props.data.label}</div>
      <div
        class="custom-drag-handle"
        style={{
          width: "15px",
          height: "15px",
          background: "#222",
        }}
      />
    </div>
  );
};

// Custom Edge Component
const CustomEdge = (props: EdgeProps) => {
  const { updateEdge } = useSolidFlow();

  const pathData = () => {
    const [path, labelX, labelY] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
    });

    return { path, labelX, labelY };
  };

  const onClick = () => {
    // Remove this edge by updating the edges store
    updateEdge(props.id, () => ({ hidden: true }));
  };

  return (
    <>
      <path
        id={props.id}
        d={pathData().path}
        style={props.style}
        class="solid-flow__edge-path"
        fill="none"
        stroke={props.selected ? "#555" : "#b1b1b7"}
        stroke-width={props.selected ? 3 : 1}
      />
      <EdgeLabel x={pathData().labelX} y={pathData().labelY}>
        <button
          style={{
            "border-radius": "50%",
            border: "none",
            width: "1rem",
            height: "1rem",
            display: "flex",
            "justify-content": "center",
            "align-items": "center",
            "font-size": "8px",
            cursor: "pointer",
            "background-color": "#eee",
          }}
          onClick={onClick}
        >
          ✕
        </button>
      </EdgeLabel>
    </>
  );
};

const nodeTypes = {
  custom: CustomNode,
  dragHandle: CustomNodeDragHandle,
};

const edgeTypes = {
  custom: CustomEdge,
};

export const Overview = () => {
  const { updateNode } = useSolidFlow();

  const [nodes, setNodes] = createNodeStore<typeof nodeTypes>([
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
      selectable: false,
    },
    {
      id: "A",
      type: "default",
      data: { label: "Styled with class" },
      class: "custom-style",
      position: { x: 150, y: 150 },
    },
    {
      id: "D",
      type: "default",
      data: { label: "Not draggable" },
      position: { x: 150, y: 200 },
      draggable: false,
    },
    {
      id: "3",
      type: "output",
      data: { label: "Output Node" },
      position: { x: 300, y: 150 },
    },
    {
      id: "B",
      type: "default",
      data: { label: "Styled with style" },
      style: { border: "2px solid #ff5050" },
      height: 55,
      position: { x: 450, y: 150 },
    },
    {
      id: "C",
      type: "dragHandle",
      data: { label: "custom drag handle" },
      dragHandle: ".custom-drag-handle",
      position: { x: 450, y: 250 },
    },
    {
      id: "4",
      type: "custom",
      data: { label: "Custom Node" },
      position: { x: 150, y: 300 },
    },
    {
      id: "hideunhide",
      type: "default",
      data: { label: "HIDE ME" },
      position: { x: 300, y: 75 },
      hidden: true,
    },
  ]);

  const [edges, setEdges] = createEdgeStore<typeof edgeTypes>([
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
      selectable: false,
    },
    {
      id: "2-4",
      type: "custom",
      source: "2",
      target: "4",
      animated: true,
    },
  ]);

  const moveNode = () => {
    setNodes(
      (node) => node.id === "1",
      produce((node) => {
        node.position.x += 20;
      }),
    );
  };

  const changeEdgeType = () => {
    setEdges(
      (edge) => edge.id === "1-2",
      produce((edge) => {
        edge.type = edge.type === "default" ? "smoothstep" : "default";
      }),
    );
  };

  const hideUnhide = () => {
    updateNode("hideunhide", (node) => ({ hidden: !node.hidden }));
  };

  const setLeftRight = () => {
    const updatedNodes = nodes.map((node) => ({
      ...node,
      sourcePosition: node.sourcePosition === Position.Right ? Position.Bottom : Position.Right,
      targetPosition: node.targetPosition === Position.Left ? Position.Top : Position.Left,
    }));

    setNodes(updatedNodes);
  };

  return (
    <>
      <style>{`
      .custom-style {
        background: #ffddcc;
        border: 2px solid #ff6b6b;
      }
    `}</style>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{
          padding: 0.1,
          nodes: [{ id: "1" }, { id: "2" }, { id: "3" }],
        }}
        minZoom={0}
        maxZoom={Infinity}
        selectionMode="full"
        initialViewport={{ x: 100, y: 100, zoom: 2 }}
        snapGrid={[25, 25]}
        autoPanOnConnect
        autoPanOnNodeDrag
        selectNodesOnDrag
        connectionMode="strict"
        attributionPosition="top-center"
        deleteKey={["Backspace", "d"]}
        onSelectionChange={({ nodes, edges }) => {
          console.log("on selection changed via prop", { nodes, edges });
        }}
      >
        <Controls
          orientation="horizontal"
          fitViewOptions={{
            padding: 0.2,
            nodes: [{ id: "1" }, { id: "2" }],
          }}
        >
          <ControlButton aria-label="log" onClick={() => console.log("control button")}>
            log
          </ControlButton>
        </Controls>
        <Background variant="dots" />
        <MiniMap />
        <Panel position="top-right">
          <button onClick={moveNode}>update node pos</button>
          <button onClick={changeEdgeType}>update edge type</button>
          <button onClick={hideUnhide}>hide/unhide</button>
          <button onClick={setLeftRight}>toggle handle pos</button>
        </Panel>
      </SolidFlow>
    </>
  );
};
