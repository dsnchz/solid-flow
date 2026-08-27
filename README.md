<p align="center">
  <!-- the %20%20 suffix works around a banner-generator bug that clips a trailing W -->
  <img src="https://assets.solidjs.com/banner?project=solid-flow%20%20&type=Ecosystem&background=tiles" alt="@dschz/solid-flow banner" />
</p>

# Solid Flow

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm](https://img.shields.io/npm/v/@dschz/solid-flow?color=blue)](https://www.npmjs.com/package/@dschz/solid-flow)
[![JSR](https://jsr.io/badges/@dschz/solid-flow)](https://jsr.io/@dschz/solid-flow)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@dschz/solid-flow)](https://bundlephobia.com/package/@dschz/solid-flow)
[![CI](https://github.com/dsnchz/solid-flow/actions/workflows/ci.yaml/badge.svg)](https://github.com/dsnchz/solid-flow/actions/workflows/ci.yaml)

A SolidJS port of [React Flow](https://reactflow.dev/) and [Svelte Flow](https://svelteflow.dev/): build node-based editors, diagrams, and interactive graphs with the same battle-tested gesture system ([@xyflow/system](https://github.com/xyflow/xyflow)) and an API designed around Solid's fine-grained reactivity.

## Version pairing

| Solid Flow | SolidJS         | Status                          |
| ---------- | --------------- | ------------------------------- |
| `1.x`      | `solid-js` 2.x  | Active development (`next` tag) |
| `0.2.x`    | `solid-js` 1.9+ | Maintenance (fixes)             |

The 1.x line is built for SolidJS 2.0 and its deferred, fine-grained reactive graph; the stable 1.0.0 ships alongside SolidJS 2.0 stable (until then, install with the `next` tag). Keep `solid-js` and `@solidjs/web` on matching 2.0 versions — mixing them breaks at import time. Upgrading from 0.2.x? See [Migrating from 0.2.x](#migrating-from-02x).

## Key Features

- **Easy to use:** Zooming and panning, single- and multi-selection of graph elements, and keyboard shortcuts out of the box
- **Customizable:** Built-in node types (Input, Output, Default, Group) and edge types (Bezier, Straight, Step, SmoothStep) with full support for custom nodes and edges — including edge reconnection via `EdgeReconnectAnchor`
- **Fine-grained by construction:** A node drag is a handful of DOM attribute writes — no virtual DOM, no component re-renders, no memoization ceremony
- **Scales to large graphs:** Off-screen elements are viewport-culled by default, and an opt-in `onlyRenderVisibleElements` mode only mounts what's visible — stress-tested at 10,000 nodes
- **Type-guided data:** Your custom components are the schema — node/edge stores narrow each element's `data` by its `type` field, with autocomplete for type names
- **Rich plugins:** Background patterns, interactive MiniMap (custom minimap nodes, click handlers), zoom Controls, Node Toolbar, and Node Resizer
- **Accessible:** Keyboard navigation, screen reader support, ARIA labels, and focus management
- **SSR-ready:** Renders on the server (a dedicated SSR test lane keeps it that way)

## Installation

```sh
npm  install @dschz/solid-flow
pnpm add     @dschz/solid-flow
yarn add     @dschz/solid-flow
bun  add     @dschz/solid-flow
```

`solid-js` is a peer dependency. Also available on [JSR](https://jsr.io/@dschz/solid-flow).

## Quick Start

```tsx
import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  type EdgeConnection,
  MiniMap,
  Panel,
  SolidFlow,
} from "@dschz/solid-flow";
import "@dschz/solid-flow/styles"; // required styles, import once

export const Flow = () => {
  const [nodes, setNodes] = createNodeStore([
    { id: "1", type: "input", data: { label: "Input" }, position: { x: 250, y: 0 } },
    { id: "2", type: "default", data: { label: "Default" }, position: { x: 100, y: 100 } },
    { id: "3", type: "output", data: { label: "Output" }, position: { x: 250, y: 200 } },
  ]);

  const [edges, setEdges] = createEdgeStore([
    { id: "e1-2", source: "1", target: "2" },
    { id: "e2-3", source: "2", target: "3" },
  ]);

  // Your stores own which elements exist — adopt new connections into
  // your edge store (see "Who owns the data" below).
  const onConnect = (connection: EdgeConnection) => {
    setEdges((edges) => {
      edges.push(connection);
    });
  };

  const nudge = () => {
    // SolidJS 2.0 store writes are drafts: mutate what changed.
    setNodes((nodes) => {
      nodes[0]!.position.x += 20;
    });
  };

  return (
    <SolidFlow nodes={nodes} edges={edges} onConnect={onConnect} fitView>
      <Controls />
      <MiniMap />
      <Background variant="dots" />
      <Panel position="top-left">
        <button onClick={nudge}>Nudge first node</button>
      </Panel>
    </SolidFlow>
  );
};
```

## Your components are the schema

`createNodeStore` / `createEdgeStore` derive each element's `data` type from the component registered for its `type` — the renderer map is the single source of truth, and the stores narrow against it:

```tsx
import {
  createNodeStore,
  Handle,
  type NodeProps,
  type NodeTypes,
  Position,
} from "@dschz/solid-flow";

const CounterNode = (props: NodeProps<{ count: number }, "counter">) => (
  <div style={{ padding: "10px", background: "white", border: "1px solid #333" }}>
    <Handle type="target" position={Position.Top} />
    <div>count: {props.data.count}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const nodeTypes = { counter: CounterNode } satisfies NodeTypes;

const [nodes] = createNodeStore<typeof nodeTypes>([
  // "counter" narrows data to { count: number }; built-ins still work
  { id: "a", type: "counter", data: { count: 1 }, position: { x: 0, y: 0 } },
  { id: "b", type: "default", data: { label: "hi" }, position: { x: 0, y: 100 } },
  // { id: "c", type: "countr", ... }   <-- compile error: unknown type name
]);

<SolidFlow nodes={nodes} nodeTypes={nodeTypes} />;
```

The same guided unions are exported as standalone types, so plain arrays, props, and vanilla stores get identical narrowing:

```tsx
import type { SolidFlowEdge, SolidFlowNode } from "@dschz/solid-flow";

const initialNodes = [
  { id: "a", type: "counter", data: { count: 1 }, position: { x: 0, y: 0 } },
] satisfies SolidFlowNode<typeof nodeTypes>[];
```

## Who owns the data

The stores you pass as `nodes` / `edges` props are **controlled** — a deliberate contract:

- **Your store owns membership.** Which nodes and edges exist is decided by your store. Any write form works: draft mutations update in place (`O(changed)`), and wholesale replacement (`setNodes(() => next)`) re-seeds the flow — rows are keyed by `id`, so surviving elements keep their runtime state.
- **The flow writes runtime fields onto your rows.** Dragging updates `position`, selection updates `selected`, measurement fills `measured` — on the same objects you provided, so reading your store is always live.
- **Imperative commands don't write membership back.** `commands.addNodes(...)` and friends update the flow, not your store. To keep an element across a store replacement, adopt it — like the `onConnect` handler in the Quick Start pushing the new connection into the edge store.

**Prefer letting the flow own the data?** Pass `defaultNodes` / `defaultEdges` instead of `nodes` / `edges` for an **uncontrolled** flow (React Flow parity): the arrays seed the flow once (later values are ignored), and membership belongs to the flow — commands like `addNodes` and completed connections persist with no adoption step. Read live state through `useSolidFlow()`'s `flow.nodes` / `flow.edges`. The two axes are independent, so you can control edges while leaving nodes uncontrolled (or vice versa); supplying both props on one axis is a mistake (`nodes` wins, with a dev warning).

## Loading your graph from an API

Both stores accept an async seed — pass `async () => data` instead of an array. No memo, no lifecycle juggling: reads are not-ready until the data lands (SolidJS 2.0's async model), so a `<Loading>` boundary holds the flow and swaps in the graph when it arrives. Afterwards the stores behave exactly like their array-seeded counterparts — drafts, adoption, wholesale replacement.

```tsx
import { Loading } from "@solidjs/web";

const fetchNodes = async () => (await fetch("/api/graph/nodes")).json();
const fetchEdges = async () => (await fetch("/api/graph/edges")).json();

export const Flow = () => {
  const [nodes] = createNodeStore(fetchNodes);
  const [edges, setEdges] = createEdgeStore(fetchEdges);

  return (
    <Loading fallback={<div>Loading graph…</div>}>
      <SolidFlow nodes={nodes} edges={edges} fitView>
        <Background variant="dots" />
      </SolidFlow>
    </Loading>
  );
};
```

Where the boundary goes is your design decision (SolidJS 2.0: "fetch high, block low") — one `<Loading>` can cover the flow together with its toolbar and sidebar, or sit tight around the flow alone. Without any boundary the flow renders immediately (canvas, controls, background) and the graph pops in when the data arrives — there is deliberately no `fallback` prop. See the AsyncData playground example for the full version (including connection adoption after the async seed).

## The flow API

`useSolidFlow()` returns `{ flow, commands }` (with `commands` also spread at the top level for React/Svelte Flow familiarity). Both are stable identities — destructuring is safe.

```tsx
import { SolidFlowProvider, useSolidFlow } from "@dschz/solid-flow";

const Toolbar = () => {
  const { flow, commands } = useSolidFlow();

  // flow.* reads are reactive: use them in JSX or tracked scopes.
  // flow.nodes, flow.edges, flow.viewport, flow.selection,
  // flow.nodesInitialized, flow.viewportInitialized, ...

  return (
    <div>
      <span>{flow.selection.nodes.length} selected</span>
      <button onClick={() => commands.fitView()}>Fit</button>
      <button onClick={() => commands.zoomIn()}>+</button>
    </div>
  );
};

// Hooks used outside <SolidFlow> children need a provider:
export const App = () => (
  <SolidFlowProvider>
    <Toolbar />
    <Flow />
  </SolidFlowProvider>
);
```

Commands include viewport control (`fitView`, `fitBounds`, `zoomIn`/`zoomOut`, `setZoom`, `setCenter`, `setViewport`, `panBy`), element updates (`updateNode`, `updateNodeData`, `updateEdge`, `addNodes`, `addEdges`, `deleteElements`), coordinate conversion (`screenToFlowPosition`, `flowToScreenPosition`), and geometry queries (`isNodeIntersecting`, `getIntersectingNodes`).

## Hooks

```tsx
const solidFlow = useSolidFlow(); // { flow, commands } — the main API
const nodes = useNodes(); // reactive readonly node array
const edges = useEdges(); // reactive readonly edge array
const viewport = useViewport(); // reactive viewport accessor
const connection = useConnection(); // in-progress connection state

// Hook parameters that feed reactive reads are accessors, so they can't
// silently go stale when derived from props:
const nodeData = useNodesData(() => ["node-1", "node-2"]);
const connections = useNodeConnections(() => ({ id: "node-1" }));
const internal = useInternalNode(() => props.nodeId); // measured/internal record

const updateInternals = useUpdateNodeInternals(); // re-measure after handle changes

// Which node/edge a nested component is rendered inside — for composable
// custom nodes and edge labels without prop drilling:
const nodeId = useNodeId();
const edgeId = useEdgeId();
```

### Coming from React Flow?

Some React Flow hooks intentionally have no Solid Flow equivalent, because Solid's fine-grained reactivity makes them unnecessary:

- `useOnSelectionChange` / `useOnViewportChange` — reading `flow.selection` or `flow.viewport` in a tracked scope IS the subscription; wrap side effects in `createEffect` over those reads.
- `useNodesState` / `useEdgesState` — use `createNodeStore` / `createEdgeStore` instead.
- `useStore` — the reactive `flow` struct is the supported read surface; there is no public escape hatch into internals.

## Custom edges and reconnection

```tsx
import { BaseEdge, EdgeReconnectAnchor, type EdgeProps, getBezierPath } from "@dschz/solid-flow";

const ReconnectableEdge = (props: EdgeProps) => {
  const path = () =>
    getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    })[0];

  return (
    <>
      <BaseEdge path={path()} markerEnd={props.markerEnd} />
      {/* drag either end of a selected edge onto another handle */}
      <EdgeReconnectAnchor type="source" position={{ x: props.sourceX, y: props.sourceY }} />
      <EdgeReconnectAnchor type="target" position={{ x: props.targetX, y: props.targetY }} />
    </>
  );
};
```

Reconnection lifecycle callbacks (`onReconnectStart`, `onReconnect`, `onReconnectEnd`, `onBeforeReconnect`) are available on `<SolidFlow>`.

## Built-in components

**Node types:** `input` (source handle only), `output` (target handle only), `default` (both), `group` (container for subflows)

**Edge types:** `default` (bezier), `straight`, `step`, `smoothstep`

**Plugins:**

- **Background** — dots, lines, and cross patterns
- **Controls** — zoom in/out, fit view, lock interactions
- **MiniMap** — interactive overview with viewport indicator, custom node rendering via `nodeComponent`, and `onClick` / `onNodeClick` handlers
- **NodeToolbar** — context-sensitive toolbars for nodes
- **NodeResizer** — interactive node resizing with handles

## Performance

Two complementary culling tiers keep large graphs fast:

- **CSS culling (always on):** Elements outside the (overscanned) viewport are hidden with `visibility: hidden` + `pointer-events: none`. Everything stays mounted, so component state, measurement, and accessibility semantics are untouched — this tier has no userland contract at all.
- **Gesture-time spatial queries:** Dragging a connection runs upstream's closest-handle search on every pointer move — a full node scan in stock React/Svelte Flow. Solid Flow snapshots node geometry into a spatial grid at gesture start (geometry is frozen mid-gesture) and answers from the pointer's neighborhood: at 10,000 nodes a connection drag went from ~422ms per move (unusable) to ~5ms median. Box selection and `getIntersectingNodes` use the same machinery.
- **`onlyRenderVisibleElements` (opt-in):** Off-screen elements are **unmounted entirely** and remount as the viewport reaches them. At 10,000 nodes this cuts the DOM ~16x, roughly halves memory, and makes node drags several times faster. Positions, selection, and cached measurements live in the flow's data graph — outside your components — so elements come back exactly as they left. Component-_local_ state does not survive unmounting: keep state you care about in `node.data`. Selected elements, unmeasured nodes, and the node holding focus are never unmounted — and an element whose content must keep running off-screen (media, timers, embeds) can opt out of culling entirely with `cullable: false` on the node or edge.

The MiniMap always renders the full graph in either mode — it reads the data graph, not the DOM.

## Server-side rendering

`<SolidFlow>` renders with `renderToString` and hydrates cleanly. For meaningful server-rendered layout, give nodes explicit `width` / `height` (there is no DOM to measure on the server) — the same guidance as React/Svelte Flow.

One contract note for headless **server-side** usage (from SolidJS 2.0's server semantics): constructing a flow and reading its derived state works under every runtime condition, but _mutating_ stores on the server (commands, setter writes) is deprecated upstream and will eventually throw — server-side state that changes over time should come from async sources (`createNodeStore(async () => …)`), which are fully supported on both builds. Rendering, jsdom tests, and browser apps are unaffected.

## Accessibility

- Full keyboard navigation (arrow-key node movement, focus traversal, Escape to deselect)
- Screen reader support with ARIA labels and live announcements
- Focus management, including under viewport culling
- Color mode support (`light` / `dark` / `system`)

## Migrating from 0.2.x

The 1.x line targets SolidJS 2.0, which changes how you write to stores, and reworks the read API. The gestures, components, plugins, and commands are otherwise the same.

**1. Upgrade the peer dependencies.** `solid-js` and `@solidjs/web` move to matching 2.0 versions.

**2. Store writes: path setters are gone (SolidJS 2.0).** Every `setNodes` / `setEdges` call site using 1.x path syntax becomes a draft callback — the callback's argument is a mutable draft, so mutation is the API. Returning a value instead replaces wholesale.

```tsx
// 0.2.x (SolidJS 1.x) — path syntax
setNodes(0, "position", "x", (x) => x + 20);
setEdges((edge) => edge.id === "e1", "animated", true);

// 1.x (SolidJS 2.0) — draft callback
setNodes((nodes) => {
  nodes[0]!.position.x += 20;
});
setEdges((edges) => {
  const edge = edges.find((e) => e.id === "e1");
  if (edge) edge.animated = true;
});

// wholesale replacement (re-seeds the flow; rows keyed by id are reused)
setNodes(() => nextNodes);
```

**3. `useSolidFlow` reads moved to the reactive `flow` struct.** The flat getters (`getNodes()`, `getEdges()`, `getNode(id)`, `getEdge(id)`, `getInternalNode(id)`, `getViewport()`, `getZoom()`) are removed:

```tsx
// 0.2.x                          // 1.x
solidFlow.getNodes();
flow.nodes;
solidFlow.getViewport();
flow.viewport;
solidFlow.getZoom();
flow.viewport.zoom;
solidFlow.getNode("a");
flow.nodes.find((n) => n.id === "a");
solidFlow.getInternalNode("a");
useInternalNode(() => "a");
```

`flow.*` reads are reactive — using them in JSX or a tracked scope subscribes. Commands (`fitView`, `setViewport`, `updateNode`, `deleteElements`, ...) are unchanged and now also available namespaced under `commands`.

**4. New connections are no longer written into your edge store.** In 0.2.x the flow inserted the connected edge into your store before `onConnect` fired. Under the 1.x ownership contract your store owns membership: adopt the connection yourself (see the Quick Start's `onConnect`). Unadopted connections still render, but won't survive a wholesale store replacement.

**5. `onlyRenderVisibleElements` now does what it says.** In 0.2.x the prop was accepted but inert. In 1.x it opts into unmount culling (off-screen elements are not mounted at all — see [Performance](#performance)), while the CSS culling tier is always on and needs no prop.

**6. Smaller signature changes.** `useNodes()` / `useEdges()` return `readonly` arrays; `useHandleEdgeSelect` is removed (it was internal plumbing — select edges through `commands`).

## Examples

The repository ships a playground with 25+ runnable examples — custom nodes and edges, edge reconnection, drag & drop, subflows, validation, minimap customization, a 10k-node stress test, accessibility, and more:

```bash
bun install
bun start
```

## Contributing: Getting Started

Some pre-requisites before install dependencies:

- Install Node Version Manager (NVM)
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ```
- Install Bun
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

### Installing Dependencies

```bash
nvm use
bun install
```

### Local Development Build

```bash
bun start
```

### Testing

```bash
bun run test      # unit + component tests (vitest, jsdom)
bun run test:ssr  # SSR lane (node environment, server builds)
bun run test:e2e  # browser gesture harness (Playwright)
```

### Linting & Formatting

```bash
bun run lint    # checks source for lint violations
bun run format  # checks source for format violations

bun run lint:fix    # fixes lint violations
bun run format:fix  # fixes format violations
```

### Contributing

The only requirements when contributing are:

- You keep a clean git history in your branch
  - rebasing `main` instead of making merge commits.
- Using proper commit message formats that adhere to [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
  - Additionally, squashing (via rebase) commits that are not [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
- CI checks pass before merging into `main`
