import type { JSX } from "@solidjs/web";
import { getStraightPath, Position } from "@xyflow/system";
import { createSignal } from "solid-js";

import { BaseEdge } from "@/components/edge";
import { Handle } from "@/components/handle";
import { SolidFlow } from "@/components/SolidFlow";
import { Background, Controls, MiniMap, NodeResizer } from "@/plugins";
import type { Edge, EdgeProps, Node, NodeProps } from "@/types";

/**
 * Flows rendered on the server (render.hydration.server.test.tsx, `generate: "ssr",
 * hydratable: true`) and hydrated over that markup in jsdom
 * (hydrate.hydration.test.tsx, the hydratable client build) — the same source
 * compiled both ways. Each scenario's `update` runs after hydration and must
 * land in the server-rendered elements.
 */
export type Scenario = {
  readonly name: string;
  readonly App: () => JSX.Element;
  /** Changes graph state after hydration. */
  readonly update: () => void;
  /** Text the flow shows once `update` has landed. */
  readonly updatedText: string;
  /** A node the client clicks after hydration to prove the flow is live. */
  readonly clickNodeId: string;
  /**
   * Elements given extra attributes (props a library component does not
   * consume): each must carry them in the server markup, and the hydrated
   * element must end with exactly the attributes the server rendered.
   */
  readonly extras?: readonly string[];
};

// Declared handle geometry: with no DOM the server cannot measure handles,
// so edges render on the server only from these (README SSR contract).
const handle = (type: "source" | "target", position: Position) => ({
  type,
  position,
  x: 72,
  y: position === Position.Bottom ? 37 : -3,
  width: 6,
  height: 6,
});

const node = (id: string, type: string | undefined, y: number, handles: Node["handles"]): Node => ({
  id,
  ...(type ? { type } : {}),
  position: { x: 0, y },
  data: { label: id },
  width: 150,
  height: 40,
  handles,
});

const graph = () => ({
  nodes: [
    node("in", "input", 0, [handle("source", Position.Bottom)]),
    node("mid", undefined, 100, [
      handle("target", Position.Top),
      handle("source", Position.Bottom),
    ]),
    node("out", "output", 200, [handle("target", Position.Top)]),
  ],
  edges: [
    { id: "e1", source: "in", target: "mid" },
    { id: "e2", source: "mid", target: "out", type: "smoothstep" },
  ] satisfies Edge[],
});

const relabel = (nodes: Node[], id: string, label: string) =>
  nodes.map((n) => (n.id === id ? { ...n, data: { label } } : n));

const builtIn = (): Scenario => {
  const { nodes: initial, edges } = graph();
  const [nodes, setNodes] = createSignal<Node[]>(initial);
  return {
    name: "built-in nodes and edges",
    App: () => <SolidFlow nodes={nodes()} edges={edges} width={800} height={600} />,
    update: () => setNodes((current) => relabel(current, "mid", "mid updated")),
    updatedText: "mid updated",
    clickNodeId: "in",
  };
};

const withPlugins = (): Scenario => {
  const { nodes: initial, edges } = graph();
  const [nodes, setNodes] = createSignal<Node[]>(initial);
  return {
    name: "with background, controls and minimap",
    App: () => (
      <SolidFlow nodes={nodes()} edges={edges} width={800} height={600}>
        <Background />
        <Controls />
        <MiniMap />
      </SolidFlow>
    ),
    update: () => setNodes((current) => relabel(current, "out", "out updated")),
    updatedText: "out updated",
    clickNodeId: "mid",
  };
};

const CardNode = (props: NodeProps<{ label: string }, "card">): JSX.Element => (
  <div class="card">
    <Handle type="target" position="top" />
    <strong>{props.data.label}</strong>
    <Handle type="source" position="bottom" />
  </div>
);
const nodeTypes = { card: CardNode };

const customNode = (): Scenario => {
  const { nodes: base, edges } = graph();
  const initial = base.map((n) => (n.id === "mid" ? { ...n, type: "card" } : n));
  const [nodes, setNodes] = createSignal<Node[]>(initial);
  return {
    name: "custom node type",
    App: () => (
      <SolidFlow nodes={nodes()} edges={edges} nodeTypes={nodeTypes} width={800} height={600} />
    ),
    update: () => setNodes((current) => relabel(current, "mid", "card updated")),
    updatedText: "card updated",
    clickNodeId: "mid",
  };
};

// Extra attributes on the per-row library elements: the client adds them from
// the element's ref (no spread on the element), so the server renders them
// itself.
const ExtrasNode = (props: NodeProps<{ label: string }, "extras">): JSX.Element => (
  <div class="extras-card">
    <Handle type="target" position="top" data-extra="handle" aria-describedby="handle-help" />
    <strong>{props.data.label}</strong>
    <Handle type="source" position="bottom" />
    <NodeResizer data-extra="resizer" />
  </div>
);

const ExtrasEdge = (props: EdgeProps): JSX.Element => {
  const path = () =>
    getStraightPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
    })[0];
  return <BaseEdge path={path()} data-extra="edge" aria-describedby="edge-help" />;
};

const extraAttributes = (): Scenario => {
  const { nodes: base, edges: baseEdges } = graph();
  const initial = base.map((n) => (n.id === "mid" ? { ...n, type: "extras" } : n));
  const edges = baseEdges.map((e) => (e.id === "e1" ? { ...e, type: "extras" } : e));
  const [nodes, setNodes] = createSignal<Node[]>(initial);
  return {
    name: "extra attributes on library elements",
    App: () => (
      <SolidFlow
        nodes={nodes()}
        edges={edges}
        nodeTypes={{ extras: ExtrasNode }}
        edgeTypes={{ extras: ExtrasEdge }}
        width={800}
        height={600}
      />
    ),
    update: () => setNodes((current) => relabel(current, "mid", "extras updated")),
    updatedText: "extras updated",
    clickNodeId: "in",
    extras: ['[data-extra="handle"]', '[data-extra="resizer"]', '[data-extra="edge"]'],
  };
};

export const scenarios: readonly (() => Scenario)[] = [
  builtIn,
  withPlugins,
  customNode,
  extraAttributes,
];
