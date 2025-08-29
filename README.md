<p align="center">
  <img src="https://assets.solidjs.com/banner?project=solid-flow&type=Ecosystem&background=tiles" alt="@dschz/solid-flow banner" />
</p>

# @dschz/solid-flow

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm](https://img.shields.io/npm/v/@dschz/solid-flow?color=blue)](https://www.npmjs.com/package/@dschz/solid-flow)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@dschz/solid-flow)](https://bundlephobia.com/package/@dschz/solid-flow)
[![CI](https://github.com/dsnchz/solid-flow/actions/workflows/ci.yaml/badge.svg)](https://github.com/dsnchz/solid-flow/actions/workflows/ci.yaml)

> Solid Flow is a port of [React Flow](https://reactflow.dev/) and [Svelte Flow](https://svelteflow.dev/) for SolidJS.

☣️ **Solid Flow is alpha and currently under development. The API intends to follow React/Svelte Flow closely but some things might change for the sake of SolidJS.** ☣️

## Current Unsupported Features:

- `onlyRenderVisibleElements` prop: the ability to only render visible elements on screen.
- Custom MiniMap nodes: the ability to render custom node visuals in the minimap
- Edge Reconnect Anchors: the ability to re-connect already connected edges

## Key Features

- **Easy to use:** Seamless zooming and panning, single- and multi selection of graph elements and keyboard shortcuts are supported out of the box
- **Customizable:** Different node types (Input, Output, Default, Group) and edge types (Bezier, Straight, Step, SmoothStep) with full support for custom nodes and edges
- **Fast rendering:** Only nodes that have changed are re-rendered using SolidJS's fine-grained reactivity
- **Rich Plugin Ecosystem:** Background patterns, Interactive MiniMap, Zoom Controls, Node Toolbar, and Node Resizer components
- **Powerful Hooks:** Comprehensive set of reactive hooks for nodes, edges, viewport, connections, and data management
- **Full Accessibility:** Complete keyboard navigation, screen reader support, ARIA labels, and focus management
- **Drag & Drop:** Built-in dragging for nodes, external drag-and-drop support, and customizable drag handles
- **Advanced Features:** Node grouping, intersection detection, connection validation, and subflow support
- **TypeScript First:** Fully typed API with generic type support and IntelliSense integration

## Installation

The easiest way to get the latest version of Solid Flow is to install it via npm, yarn or pnpm:

```sh
npm install @dschz/solid-flow
```

## Quick Start

This is a basic example to get you started. For more advanced examples and full API documentation, explore the playground examples included in this repository.

```tsx
import { addEdge, type EdgeConnection, createEdgeStore, createNodeStore } from "@dschz/solid-flow";
import { SolidFlow, Controls, Background, MiniMap } from "@dschz/solid-flow";
import "@dschz/solid-flow/styles"; // Required styles

export default function Flow() {
  // Use createNodeStore and createEdgeStore for reactive state management
  const [nodes, setNodes] = createNodeStore([
    {
      id: "1",
      type: "input",
      data: { label: "Input Node" },
      position: { x: 250, y: 0 },
    },
    {
      id: "2",
      type: "default",
      data: { label: "Default Node" },
      position: { x: 100, y: 100 },
    },
    {
      id: "3",
      type: "output",
      data: { label: "Output Node" },
      position: { x: 250, y: 200 },
    },
  ]);

  const [edges, setEdges] = createEdgeStore([
    { id: "e1-2", source: "1", target: "2" },
    { id: "e2-3", source: "2", target: "3" },
  ]);

  const onConnect = (connection: EdgeConnection) => {
    /**
     * Solid Flow updates the node/edge stores internally. The user-land edge store will have the connection inserted by the time onConnect fires so we can just go ahead and update the state of it
     */
    setEdges(
      (edge) => edge.id === connection.id,
      produce((edge) => {
        edge.animated = true;
      }),
    );
  };

  return (
    <SolidFlow nodes={nodes} edges={edges} onConnect={onConnect} fitView>
      <Controls />
      <MiniMap />
      <Background variant="dots" />
    </SolidFlow>
  );
}
```

## Core Components

### Built-in Node Types

- **InputNode** - Nodes with source handles only (starting points)
- **OutputNode** - Nodes with target handles only (ending points)
- **DefaultNode** - Standard nodes with both source and target handles
- **GroupNode** - Container nodes for organizing other nodes

### Built-in Edge Types

- **BezierEdge** - Smooth curved connections (default)
- **StraightEdge** - Direct straight line connections
- **StepEdge** - Right-angle step connections
- **SmoothStepEdge** - Rounded step connections

### Plugin Components

- **Background** - Customizable canvas backgrounds (dots, lines, cross patterns)
- **Controls** - Zoom in/out, fit view, lock/unlock interactions
- **MiniMap** - Interactive overview with viewport indicator
- **NodeToolbar** - Context-sensitive toolbars for nodes
- **NodeResizer** - Real-time node resizing with handles

## Hooks & Utilities

### Essential Hooks

```tsx
// Main flow instance with full API
const solidFlow = useSolidFlow();

// Reactive access to nodes and edges
const nodes = useNodes();
const edges = useEdges();

// Viewport control and monitoring
const viewport = useViewport();

// Connection state during drag operations
const connection = useConnection();

// Reactive access to node data
const nodeData = useNodesData(["node-1", "node-2"]);

// Node connection information
const connections = useNodeConnections("node-1");
```

### Utility Functions

```tsx
// Create reactive stores (replaces signals)
const [nodes, setNodes] = createNodeStore(initialNodes);
const [edges, setEdges] = createEdgeStore(initialEdges);

// Update stores with SolidJS patterns
import { produce } from "solid-js/store";
setNodes(
  (node) => node.id === "1",
  produce((node) => {
    node.position.x += 20;
  }),
);

// Add new connections
setEdges(addEdge(connection, edges));

// Coordinate transformations (via useSolidFlow)
const { screenToFlowPosition, flowToScreenPosition } = useSolidFlow();

// Node/edge utilities
getNodesBounds(nodes);
getIntersectingNodes(node, nodes);
```

## Advanced Features

### Custom Nodes and Edges

Create fully customized components with multiple handles:

```tsx
import { Handle, type NodeProps } from "@dschz/solid-flow";

// Type-safe custom node component
function CustomNode(props: NodeProps<{ label: string }, "custom">) {
  return (
    <div class="custom-node" style={{ padding: "10px", background: "white" }}>
      <Handle type="target" position="top />
      <div>{props.data.label}</div>
      <Handle type="source" position="bottom" id="output-a" />
      <Handle type="source" position="bottom id="output-b" style={{ left: "80%" }} />
    </div>
  );
}

// Create type-safe node types
const nodeTypes = {
  custom: CustomNode,
} satisfies NodeTypes;

// Use with typed store
const [nodes] = createNodeStore<typeof nodeTypes>([...]);

<SolidFlow nodeTypes={nodeTypes} nodes={nodes} ... />
```

### Connection Validation

```tsx
import { type Connection } from "@dschz/solid-flow";

const isValidConnection = (connection: Connection) => {
  // Custom validation logic
  return connection.source !== connection.target;
};

const onConnect = (connection: Connection) => {
  console.log("New connection:", connection);
  setEdges(addEdge(connection, edges));
};

<SolidFlow
  isValidConnection={isValidConnection}
  onConnect={onConnect}
  ...
/>
```

### Event Handling

```tsx
<SolidFlow
  onNodeClick={(event, node) => console.log("Node clicked:", node)}
  onNodeDrag={(event, node) => console.log("Node dragged:", node)}
  onEdgeClick={(event, edge) => console.log("Edge clicked:", edge)}
  onPaneClick={(event) => console.log("Pane clicked")}
  onSelectionChange={(params) => console.log("Selection changed:", params)}
/>
```

## Accessibility

Solid Flow includes comprehensive accessibility features:

- Full keyboard navigation support
- Screen reader compatibility with ARIA labels
- Focus management and visual indicators
- High contrast and color mode support
- Customizable keyboard shortcuts

## Performance

- **Reactive Updates**: Only re-renders components when their specific data changes
- **Viewport Optimization**: Option to render only visible elements (coming soon)
- **Memory Efficient**: Optimized data structures for large graphs
- **Stress Tested**: Handles hundreds of nodes smoothly

## Examples

The repository includes a comprehensive playground with 25+ examples:

- **Basic Usage** - Simple flows and interactions
- **Custom Nodes** - Creating specialized node types
- **Edge Types** - Different connection styles
- **Drag & Drop** - External elements and node creation
- **Validation** - Connection rules and constraints
- **Subflows** - Hierarchical node organization
- **Performance** - Large dataset handling
- **Accessibility** - Keyboard navigation and screen readers

Run the examples locally:

```bash
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
