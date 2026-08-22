/**
 * The headless data graph (P3.2, design: .agent/planning/p32-flowstate.md).
 *
 * Everything in src/core is DOM-free: writable roots + a DAG of keyed
 * projections deriving the flow's state, composed into the FlowState struct.
 * The UI layer (src/components) subscribes to it and owns every DOM seam
 * (measurement ingest, gesture controllers, resize observers).
 *
 * The FlowState/FlowCommands types (and connectionKey/ConnectionsRecord) are
 * re-exported from the package entrypoint; the rest is internal.
 */
export { createEdgeStore } from "./createEdgeStore";
export {
  createFlowState,
  type FlowStateInjections,
  type MeasureRequestEntry,
} from "./createFlowState";
export { createNodeStore } from "./createNodeStore";
export { getDefaultFlowStateProps } from "./defaults";
export { RecordMapFacade } from "./facades";
export type { FlowCommands, FlowSelection, FlowState } from "./flowState";
export {
  connectionKey,
  type ConnectionsRecord,
  type ConnectionsSource,
  createConnections,
} from "./projections/connections";
export { createEdgeLookup, type EdgeLookupSource } from "./projections/edgeLookup";
export {
  calculateZ,
  createInternalNodes,
  type InternalNodesSource,
  isManualZIndexMode,
  type NodeMeasurement,
  type NodeMeasurements,
  type NodeMeasurementWrite,
} from "./projections/internalNodes";
export { createLayoutedEdges, type LayoutedEdgesSource } from "./projections/layoutedEdges";
export { createParentIds, type ParentIdsSource } from "./projections/parentIds";
