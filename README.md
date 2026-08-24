<p align="center">
  <img src="https://assets.solidjs.com/banner?project=solid-flow&type=Ecosystem&background=tiles" alt="@dschz/solid-flow banner" />
</p>

# Solid Flow

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm](https://img.shields.io/npm/v/@dschz/solid-flow?color=blue)](https://www.npmjs.com/package/@dschz/solid-flow)
[![JSR](https://jsr.io/badges/@dschz/solid-flow)](https://jsr.io/@dschz/solid-flow)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@dschz/solid-flow)](https://bundlephobia.com/package/@dschz/solid-flow)
[![CI](https://github.com/dsnchz/solid-flow/actions/workflows/ci.yaml/badge.svg)](https://github.com/dsnchz/solid-flow/actions/workflows/ci.yaml)

A SolidJS port of [React Flow](https://reactflow.dev/) and [Svelte Flow](https://svelteflow.dev/): build node-based editors, diagrams, and interactive graphs with the same battle-tested gesture system ([@xyflow/system](https://github.com/xyflow/xyflow)) and an API designed around Solid's fine-grained reactivity.

## Version pairing

| Solid Flow | SolidJS         | Status              |
| ---------- | --------------- | ------------------- |
| `0.3.x`    | `solid-js` 2.x  | Active development  |
| `0.2.x`    | `solid-js` 1.9+ | Maintenance (fixes) |

The 0.3 line is built for SolidJS 2.0 and its deferred, fine-grained reactive graph. Keep `solid-js` and `@solidjs/web` on matching 2.0 versions — mixing them breaks at import time.

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
import type { EdgesFor, NodesFor } from "@dschz/solid-flow";

const initialNodes = [
  { id: "a", type: "counter", data: { count: 1 }, position: { x: 0, y: 0 } },
] satisfies NodesFor<typeof nodeTypes>[];
```

## Who owns the data

The stores you pass as `nodes` / `edges` props are **controlled** — a deliberate contract:

- **Your store owns membership.** Which nodes and edges exist is decided by your store. Any write form works: draft mutations update in place (`O(changed)`), and wholesale replacement (`setNodes(() => next)`) re-seeds the flow — rows are keyed by `id`, so surviving elements keep their runtime state.
- **The flow writes runtime fields onto your rows.** Dragging updates `position`, selection updates `selected`, measurement fills `measured` — on the same objects you provided, so reading your store is always live.
- **Imperative commands don't write membership back.** `commands.addNodes(...)` and friends update the flow, not your store. To keep an element across a store replacement, adopt it — like the `onConnect` handler in the Quick Start pushing the new connection into the edge store.

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
- **`onlyRenderVisibleElements` (opt-in):** Off-screen elements are **unmounted entirely** and remount as the viewport reaches them. At 10,000 nodes this cuts the DOM ~16x, roughly halves memory, and makes node drags several times faster. Positions, selection, and cached measurements live in the flow's data graph — outside your components — so elements come back exactly as they left. Component-_local_ state does not survive unmounting: keep state you care about in `node.data`. Selected elements, unmeasured nodes, and the node holding focus are never unmounted.

The MiniMap always renders the full graph in either mode — it reads the data graph, not the DOM.

## Server-side rendering

`<SolidFlow>` renders with `renderToString` and hydrates cleanly. For meaningful server-rendered layout, give nodes explicit `width` / `height` (there is no DOM to measure on the server) — the same guidance as React/Svelte Flow.

## Accessibility

- Full keyboard navigation (arrow-key node movement, focus traversal, Escape to deselect)
- Screen reader support with ARIA labels and live announcements
- Focus management, including under viewport culling
- Color mode support (`light` / `dark` / `system`)

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
