import { createSignal, DEV, flush, onCleanup, Show } from "solid-js";
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  NodeResizer,
  SolidFlow,
  SolidFlowProvider,
  useSolidFlow,
} from "@/index";

// `resizer=1`: node 5-5 renders with an always-visible NodeResizer so the
// bench can drive the measurement-write cadence (resize frames) at scale.
const ResizerNode = (props: NodeProps<{ label: string }>) => (
  <>
    <NodeResizer visible minWidth={40} minHeight={20} />
    <Handle type="target" position="left" />
    <div>{props.data?.label}</div>
    <Handle type="source" position="right" />
  </>
);
const stressNodeTypes = { resizer: ResizerNode };

// Exposes the flow API to the bench driver (pan via commands.setViewport).
const BenchProbe = () => {
  const api = useSolidFlow();
  // Dev-only attribution (solid-js rc.7+): `?attr=1` enables the engine's
  // why-chains/costs() for the perf loop; DEV is undefined in prod builds.
  if (DEV && new URLSearchParams(window.location.search).get("attr") === "1") {
    DEV.attribution.enable();
  }
  const w = window as Window & { __bench?: { api?: unknown; DEV?: unknown } };
  const bench = (w.__bench ??= {});
  Object.assign(bench, { api, DEV });
  // An unmounted flow must not stay reachable through the probe (the memory
  // bench measures what an unmount releases).
  onCleanup(() => {
    delete bench.api;
    delete bench.DEV;
  });
  return null;
};

// Benchmark-instrumented stress grid. URL params:
//   x, y     grid dimensions (default 25x25 = 625 nodes, 624 chained edges)
//   minimap  "1" to include the MiniMap (default off, to isolate the graph pipeline)
//   unmount  "1" to opt into unmount culling (onlyRenderVisibleElements)
//   fit      "0" to skip fitView so the grid overflows the viewport (culling visible)
//   resizer  "1" to give node 5-5 an always-visible NodeResizer
//   uncontrolled "1" to seed via defaultNodes/defaultEdges (the flow copies and owns the rows)
//   attr     "1" to enable DEV.attribution (dev builds only)
//   provider "1" to give the flow its own SolidFlowProvider INSIDE the unmount
//            toggle (full teardown; the playground's app-level provider
//            otherwise owns the state and survives the canvas)
//
// window.__bench.setMounted(false) unmounts the whole SolidFlow (the memory
// bench compares what an unmount releases against a delete-all).
//
// window.__bench.flush lets the driver force synchronous completion of a
// dispatched interaction (Solid 2.0 defers to microtask flush; the 0.2.3
// twin app stubs this with a no-op because 1.x updates synchronously).
export const StressTest = () => {
  const params = new URLSearchParams(window.location.search);
  const xNodes = Number(params.get("x") ?? 50);
  const yNodes = Number(params.get("y") ?? 30);
  const withMiniMap = params.get("minimap") === "1";
  const withEdges = params.get("edges") !== "0";
  const withUnmountCulling = params.get("unmount") === "1";
  const withFitView = params.get("fit") !== "0";
  const withResizer = params.get("resizer") === "1";
  const uncontrolled = params.get("uncontrolled") === "1";
  const ownProvider = params.get("provider") === "1";

  const nodeItems: Node[] = [];
  const edgeItems: Edge[] = [];

  let source: Node | null = null;

  for (let y = 0; y < yNodes; y++) {
    for (let x = 0; x < xNodes; x++) {
      const position = { x: x * 100, y: y * 50 };
      const id = `${x}-${y}`;
      const data = { label: `Node ${id}` };
      const node: Node = {
        id,
        data,
        position,
        type: withResizer && id === "5-5" ? "resizer" : "default",
        ...(withResizer && id === "5-5" ? { width: 120, height: 60 } : {}),
      };
      nodeItems.push(node);

      if (source && withEdges) {
        const edge: Edge = {
          id: `${source.id}-${id}`,
          source: source.id,
          target: id,
        };
        edgeItems.push(edge);
      }

      source = node;
    }
  }

  const [mounted, setMounted] = createSignal(true);
  (window as Window & { __bench?: unknown }).__bench = { flush, setMounted };

  const canvas = () => (
    <SolidFlow
      {...(uncontrolled
        ? { defaultNodes: nodeItems, defaultEdges: edgeItems }
        : { nodes: nodeItems, edges: edgeItems })}
      nodeTypes={stressNodeTypes}
      fitView={withFitView}
      onlyRenderVisibleElements={withUnmountCulling}
      minZoom={0.1}
      onFlowError={(id, message) => {
        console.error(id, message);
      }}
    >
      <BenchProbe />
      <Controls />
      <Background variant="lines" />
      {withMiniMap && <MiniMap />}
    </SolidFlow>
  );

  return (
    <Show when={mounted()}>
      <Show when={ownProvider} fallback={canvas()}>
        <SolidFlowProvider>{canvas()}</SolidFlowProvider>
      </Show>
    </Show>
  );
};
