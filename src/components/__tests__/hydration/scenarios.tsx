import type { JSX } from "@solidjs/web";
import { Position } from "@xyflow/system";
import { createSignal } from "solid-js";

import { Handle } from "@/components/handle";
import { SolidFlow } from "@/components/SolidFlow";
import { Background, Controls, MiniMap } from "@/plugins";
import type { Edge, Node, NodeProps } from "@/types";

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

export const scenarios: readonly (() => Scenario)[] = [builtIn, withPlugins, customNode];
