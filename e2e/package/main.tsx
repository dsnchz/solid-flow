import "@dschz/solid-flow/style.css";

import {
  Background,
  BaseEdge,
  Controls,
  createEdgeStore,
  createNodeStore,
  EdgeLabel,
  type EdgeProps,
  EdgeReconnectAnchor,
  EdgeToolbar,
  getBezierPath,
  Handle,
  MiniMap,
  type NodeProps,
  NodeResizer,
  NodeToolbar,
  Panel,
  SolidFlow,
  useSolidFlow,
  ViewportPortal,
} from "@dschz/solid-flow";
import { render } from "@solidjs/web";
import { onCleanup } from "solid-js";

// Every public component a typical graph renders, so that the app's own
// compile of the shipped JSX build runs each of them at least once.

const CounterNode = (props: NodeProps<{ count: number }, "counter">) => (
  <>
    <NodeResizer minWidth={60} minHeight={30} />
    <NodeToolbar isVisible>toolbar</NodeToolbar>
    <Handle type="target" position="top" />
    <span class="count">count: {props.data.count}</span>
    <Handle type="source" position="bottom" />
  </>
);

const LabeledEdge = (props: EdgeProps) => {
  const path = () =>
    getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    });
  return (
    <>
      <BaseEdge path={path()[0]} markerEnd={props.markerEnd} />
      <EdgeLabel x={path()[1]} y={path()[2]}>
        custom label
      </EdgeLabel>
      <EdgeToolbar x={path()[1]} y={path()[2]} isVisible>
        edge toolbar
      </EdgeToolbar>
      <EdgeReconnectAnchor type="source" position={{ x: props.sourceX, y: props.sourceY }} />
      <EdgeReconnectAnchor type="target" position={{ x: props.targetX, y: props.targetY }} />
    </>
  );
};

const nodeTypes = { counter: CounterNode };
const edgeTypes = { labeled: LabeledEdge };

const Probe = () => {
  // The spec reads the flow API from this test global (e2e/package.spec.ts).
  const w = window as unknown as { __flow?: ReturnType<typeof useSolidFlow> };
  w.__flow = useSolidFlow();
  onCleanup(() => delete w.__flow);
  return null;
};

const App = () => {
  const [nodes] = createNodeStore<typeof nodeTypes>([
    { id: "in", type: "input", data: { label: "input" }, position: { x: 0, y: 0 } },
    { id: "counter", type: "counter", data: { count: 1 }, position: { x: 0, y: 120 } },
    { id: "untyped", data: { label: "untyped default" }, position: { x: 220, y: 120 } },
    { id: "out", type: "output", data: { label: "output" }, position: { x: 0, y: 260 } },
  ]);
  const [edges] = createEdgeStore<typeof edgeTypes>([
    { id: "in-counter", source: "in", target: "counter", label: "built-in label" },
    {
      id: "counter-out",
      source: "counter",
      target: "out",
      type: "labeled",
      markerEnd: { type: "arrowclosed" },
    },
    { id: "in-untyped", source: "in", target: "untyped", type: "smoothstep" },
  ]);
  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      onFlowError={(id, message) => console.error(id, message)}
    >
      <Probe />
      <Background />
      <Controls />
      <MiniMap />
      <Panel position="top-right">panel</Panel>
      <ViewportPortal>
        <div class="portal-content">portal</div>
      </ViewportPortal>
    </SolidFlow>
  );
};

render(() => <App />, document.getElementById("root")!);
