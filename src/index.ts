export * from "./components";
export {
  connectionKey,
  type ConnectionsRecord,
  type FlowCommands,
  type FlowSelection,
  type FlowState,
  type SolidFlowInitialProps,
  type SolidFlowProps,
} from "./core";
export {
  createEdgeStore,
  createNodeStore,
  createOptimisticEdgeStore,
  createOptimisticNodeStore,
  type SolidFlowEdge,
  type SolidFlowNode,
} from "./core";
export * from "./hooks";
export * from "./plugins";

// types
export type {
  BezierEdgeProps,
  BuiltInEdge,
  DefaultEdgeOptions,
  Edge,
  EdgeProps,
  EdgeTypes,
  SmoothStepEdgeProps,
  StepEdgeProps,
  StraightEdgeProps,
} from "./types/edge";
export * from "./types/events";
export * from "./types/general";
export type {
  BuiltInNode,
  BuiltInNodeTypes,
  InternalNode,
  Node,
  NodeProps,
  NodeTypes,
} from "./types/node";

// system utilities (documented upstream)
export {
  addEdge,
  getBezierPath,
  getConnectedEdges,
  getIncomers,
  getNodesBounds,
  getOutgoers,
  getSmoothStepPath,
  getStraightPath,
  getViewportForBounds,
} from "@xyflow/system";

// system enums (documented upstream)
// Erasable mirrors of @xyflow/system's enums (member objects + union types)
// live in ./types/general and flow through its star export above.

// system types (documented upstream)
export type {
  Connection,
  ControlLinePosition,
  ControlPosition,
  CoordinateExtent,
  EdgeMarker,
  FitBounds,
  HandleConnection,
  NodeConnection,
  NodeOrigin,
  OnMove,
  PanelPosition,
  SetCenter,
  SetViewport,
  ShouldResize,
  Viewport,
  XYPosition,
} from "@xyflow/system";

// system symbols re-declared with docs (undocumented upstream); the explicit
// re-exports resolve name collisions with ./types/general and ./types/events
// in favor of the system-shaped versions (matching the pre-existing API)
export type { IsValidConnection, OnSelectionDrag } from "./types/system";
export * from "./types/system";
export { SelectionMode } from "./types/system";
