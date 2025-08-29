# @dschz/solid-flow

## 0.1.1

### Patch Changes

- Fix repository link

## 0.1.0

### Major Changes

- **🎉 Initial Alpha Release**: First public release of Solid Flow - a highly customizable SolidJS library for building node-based editors, workflow systems, and interactive diagrams

### ✨ Core Features

#### **Main Components**

- **`SolidFlow`**: Main flow component with comprehensive props and event handling
- **`SolidFlowProvider`**: Context provider for multi-flow scenarios and advanced state management

#### **Built-in Node Types**

- **`InputNode`**: Nodes with source handles only (workflow starting points)
- **`OutputNode`**: Nodes with target handles only (workflow ending points)
- **`DefaultNode`**: Standard nodes with both source and target handles
- **`GroupNode`**: Container nodes for organizing and grouping other nodes

#### **Built-in Edge Types**

- **`BezierEdge`**: Smooth curved connections (default styling)
- **`StraightEdge`**: Direct straight-line connections
- **`StepEdge`**: Right-angle step-style connections
- **`SmoothStepEdge`**: Rounded step connections with smooth corners

#### **Plugin Components**

- **`Background`**: Customizable canvas backgrounds with multiple pattern variants:
  - Dots pattern with configurable size and spacing
  - Lines pattern for grid-style backgrounds
  - Cross pattern for intersection guides
  - Support for multiple background layers
- **`Controls`**: Interactive zoom and viewport controls:
  - Zoom in/out buttons
  - Fit view to show all nodes
  - Lock/unlock interaction toggle
  - Horizontal and vertical orientations
  - Custom control button support
- **`MiniMap`**: Interactive overview component:
  - Real-time viewport indicator
  - Clickable navigation
  - Customizable node colors and styling
  - Configurable size and positioning
- **`NodeToolbar`**: Context-sensitive toolbars for nodes:
  - Multiple positioning options (top, bottom, left, right)
  - Alignment controls (start, center, end)
  - Custom toolbar content support
  - Selection-based visibility
- **`NodeResizer`**: Real-time node resizing capabilities:
  - Multiple resize handle positions
  - Custom resize controls and constraints
  - Aspect ratio maintenance
  - Minimum/maximum size limits

### 🎣 **Reactive State Management**

#### **Store-Based Architecture**

- **`createNodeStore()`**: Type-safe reactive store for nodes with full TypeScript support
- **`createEdgeStore()`**: Type-safe reactive store for edges with custom type integration
- **`createSolidFlow()`**: Core flow state management with SolidJS reactivity

#### **Essential Hooks**

- **`useSolidFlow()`**: Main flow instance hook with comprehensive API:
  - `addNodes()`, `updateNode()`, `deleteElements()` for programmatic control
  - `screenToFlowPosition()`, `flowToScreenPosition()` for coordinate transformations
  - `fitView()`, `zoomIn()`, `zoomOut()` for viewport management
- **`useConnection()`**: Real-time connection state during drag operations
- **`useNodesData()`**: Reactive access to specific node data with automatic updates
- **`useNodeConnections()`**: Get connection information for specific nodes
- **`useUpdateNodeInternals()`**: Force node internal updates for custom components

### 🎨 **Customization & Extensibility**

#### **Custom Components**

- Full TypeScript support for custom node and edge components
- `NodeProps<TData, TType>` and `EdgeProps<TData, TType>` for type-safe component creation
- Multiple handle support with custom positioning and styling
- Custom drag handles with selector-based configuration

#### **Type Safety**

- Generic type parameters for nodes and edges throughout the API
- `satisfies NodeTypes` and `satisfies EdgeTypes` patterns for type inference
- Automatic data validation based on node/edge types
- IntelliSense support for custom component properties

#### **Styling & Theming**

- CSS custom properties support for theme customization
- Light/dark/system color modes with SSR support
- Comprehensive CSS class system for styling overrides
- Color mode transitions and user preference detection

### 🎯 **Interaction & Navigation**

#### **Viewport Controls**

- Smooth pan and zoom with mouse, touch, and keyboard support
- Configurable zoom limits and pan boundaries
- Snap-to-grid functionality with customizable grid sizes
- Fit view with padding and specific node targeting

#### **Selection System**

- Single and multi-node/edge selection
- Selection box (drag-to-select multiple items)
- Keyboard shortcuts (Ctrl/Cmd+click, Shift+click)
- Programmatic selection control with event callbacks

#### **Drag & Drop**

- Built-in node dragging with multi-selection support
- External drag-and-drop for adding new elements
- Custom drag handles for specialized interactions
- Auto-panning during drag operations
- Drag threshold configuration

### ♿ **Accessibility Features**

#### **Keyboard Navigation**

- Full tab navigation between focusable elements
- Arrow key navigation for selected nodes
- Enter/Space key activation for selection
- Delete key for removing selected elements
- Customizable keyboard shortcuts and key bindings

#### **Screen Reader Support**

- ARIA labels and descriptions for all interactive elements
- `A11yDescriptions` component for enhanced screen reader context
- Semantic HTML structure throughout components
- Focus management and visual indicators
- High contrast mode compatibility

### ⚡ **Performance & Optimization**

#### **Rendering Performance**

- Fine-grained reactivity using SolidJS's reactive primitives
- Only re-renders components when their specific data changes
- Efficient viewport calculations and coordinate transformations
- Memory-optimized node and edge storage

#### **Large Dataset Handling**

- Stress-tested with hundreds of nodes and edges
- Optimized selection algorithms for large graphs
- Efficient intersection detection and bounds calculations
- `onlyRenderVisibleElements` prop (planned - currently no-op for performance reasons)

### 🔧 **Developer Experience**

#### **Comprehensive Examples**

- **25+ Interactive Examples** in the included playground:
  - Basic usage and getting started
  - Custom nodes and edges with multiple handles
  - Drag and drop from external elements
  - Connection validation and rules
  - Accessibility and keyboard navigation
  - Performance testing with large datasets
  - Subflows and hierarchical organization
  - Edge types and styling variations
  - Node toolbar and resizer implementations

#### **TypeScript Integration**

- Full TypeScript support with strict type checking
- Generic type parameters throughout the API
- IntelliSense support for all components and hooks
- Type-safe custom component creation
- Automatic type inference for node and edge data

#### **Development Tools**

- Comprehensive error handling with development warnings
- Performance monitoring and debugging utilities
- Hot reload support during development
- Source map support for debugging

### 🔗 **Connection System**

#### **Connection Handling**

- Drag-to-connect interface with visual feedback
- Click-to-connect alternative interaction mode
- Connection validation with `isValidConnection` callback
- Custom connection line components with full styling control
- Auto-panning during connection creation

#### **Handle System**

- Multiple handles per node (source and target)
- Custom handle positioning with `Position` enum
- Handle-specific connection rules and validation
- Visual feedback during connection attempts
- Custom handle styling and behavior

### 📊 **Utility Functions**

#### **Coordinate Transformations**

- `screenToFlowPosition()`: Convert screen coordinates to flow coordinates
- `flowToScreenPosition()`: Convert flow coordinates to screen coordinates
- Automatic viewport transformation handling

#### **Graph Utilities**

- `getNodesBounds()`: Calculate bounding box for node collections
- `getIntersectingNodes()`: Find nodes that intersect with a given node
- `getConnectedEdges()`: Get all edges connected to specific nodes
- `getIncomers()` and `getOutgoers()`: Get connected nodes in specific directions

#### **Edge Utilities**

- `addEdge()`: Add new edges to existing collections
- `getBezierPath()`, `getStraightPath()`, `getSmoothStepPath()`: Path calculation utilities
- `getEdgeCenter()`: Calculate center points for edge labeling

### 🏗️ **Architecture & Patterns**

#### **Store-First Design**

- Built around SolidJS's reactive store system rather than signals
- Immutable updates using `produce()` from solid-js/store
- Automatic subscription to store changes throughout the component tree

#### **Event System**

- Comprehensive event handling for all user interactions:
  - Node events: click, drag, hover, focus, context menu
  - Edge events: click, hover, focus, context menu
  - Pane events: click, context menu, viewport changes
  - Selection events: selection start, change, and end
  - Connection events: connection start, connect, and end

#### **Plugin Architecture**

- Modular plugin components that integrate seamlessly
- Consistent API patterns across all plugin components
- Easy integration of custom plugins following established patterns

### 🔄 **Compatibility & Integration**

#### **SolidJS Integration**

- Built specifically for SolidJS 1.8.0+
- Leverages SolidJS's fine-grained reactivity system
- Compatible with SolidJS ecosystem tools and patterns
- SSR support for server-side rendering scenarios

#### **External Dependencies**

- `@xyflow/system`: Core flow logic and utilities (v0.0.68)
- `@solid-primitives/*`: SolidJS primitive utilities for enhanced functionality
- `clsx`: Utility for conditional CSS class names
- Minimal dependency footprint for bundle size optimization

### 📦 **Package & Distribution**

#### **Multiple Export Formats**

- ESM modules with tree-shaking support
- TypeScript declaration files included
- Separate styles export for CSS customization
- Optimized bundle sizes for production use

#### **Development Setup**

- Comprehensive development playground with live examples
- Vite-based development server with HMR
- TypeScript strict mode for development
- ESLint and Prettier configuration included
- Vitest for comprehensive testing

### 🚧 **Known Limitations (Alpha Release)**

- `onlyRenderVisibleElements` prop currently no-op (performance optimization needed)
- Custom MiniMap nodes not yet supported
- Edge reconnect anchors not implemented
- Some advanced React Flow features still in development

### 📋 **Migration Notes**

This is the first release, so no migration is needed. However, developers familiar with React Flow or Svelte Flow should note:

- Uses **stores instead of signals** for state management
- Connection handling uses `onConnect` with store updates rather than state setters
- TypeScript patterns follow SolidJS conventions
- Event handlers receive SolidJS-specific event objects

---

**Full Changelog**: https://github.com/dsnchz/solid-flow/releases/tag/v0.1.0
