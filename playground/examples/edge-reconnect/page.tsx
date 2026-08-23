import { createSignal, Show } from "solid-js";

import {
  Background,
  BaseEdge,
  Controls,
  createEdgeStore,
  createNodeStore,
  EdgeReconnectAnchor,
  type EdgeProps,
  getBezierPath,
  Panel,
  SolidFlow,
} from "@/index";

// Custom edge with reconnectable ends (Svelte Flow's ButtonEdge pattern):
// select the edge, then drag either endpoint dot onto another handle.
const ReconnectableEdge = (props: EdgeProps) => {
  const [reconnecting, setReconnecting] = createSignal(false);

  const path = () =>
    getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    })[0];

  const anchorDot = (
    <div
      style={{
        width: "12px",
        height: "12px",
        "border-radius": "50%",
        background: "#ff5050",
        border: "2px solid white",
      }}
    />
  );

  return (
    <>
      <Show when={!reconnecting()}>
        <BaseEdge path={path()} markerEnd={props.markerEnd} style={props.style} />
      </Show>
      <Show when={props.selected}>
        <EdgeReconnectAnchor
          type="source"
          position={{ x: props.sourceX, y: props.sourceY }}
          onReconnectingChange={setReconnecting}
        >
          {anchorDot}
        </EdgeReconnectAnchor>
        <EdgeReconnectAnchor
          type="target"
          position={{ x: props.targetX, y: props.targetY }}
          onReconnectingChange={setReconnecting}
        >
          {anchorDot}
        </EdgeReconnectAnchor>
      </Show>
    </>
  );
};

const edgeTypes = {
  reconnectable: ReconnectableEdge,
};

export const EdgeReconnect = () => {
  const [nodes] = createNodeStore([
    { id: "1", type: "input", data: { label: "Source" }, position: { x: 50, y: 50 } },
    { id: "2", type: "default", data: { label: "Target A" }, position: { x: 350, y: 150 } },
    { id: "3", type: "default", data: { label: "Target B" }, position: { x: 350, y: 300 } },
  ]);
  const [edges] = createEdgeStore<typeof edgeTypes>([
    { id: "e1", source: "1", target: "2", type: "reconnectable" },
  ]);

  const [status, setStatus] = createSignal("select the edge, then drag an endpoint dot");

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      edgeTypes={edgeTypes}
      fitView
      onReconnectStart={(_event, edge, handleType) =>
        setStatus(`reconnecting ${edge.id} from its ${handleType} end...`)
      }
      onReconnect={(oldEdge, connection) =>
        setStatus(`reconnected ${oldEdge.id}: now ${connection.source} -> ${connection.target}`)
      }
      onReconnectEnd={(_event, _edge, _handleType, state) =>
        setStatus((prev) => `${prev} | gesture ended (valid: ${String(state.isValid)})`)
      }
    >
      <Controls />
      <Background variant="dots" />
      <Panel position="top-left">
        <div data-testid="reconnect-status" style={{ background: "#fff", padding: "4px 8px" }}>
          {status()}
        </div>
      </Panel>
    </SolidFlow>
  );
};
