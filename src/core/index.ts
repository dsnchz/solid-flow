/**
 * The headless data graph (P3.2, design: .agent/planning/p32-flowstate.md).
 *
 * Everything in src/core is DOM-free: writable roots + a DAG of keyed
 * projections deriving the flow's state, composed into the FlowState struct.
 * The UI layer (src/components) subscribes to it and owns every DOM seam
 * (measurement ingest, gesture controllers, resize observers).
 *
 * Internal only — nothing here is exported from the package entrypoint until
 * the FlowState struct stabilizes.
 */
export {
  connectionKey,
  type ConnectionsRecord,
  type ConnectionsSource,
  createConnections,
} from "./projections/connections";
export { createEdgeLookup, type EdgeLookupSource } from "./projections/edgeLookup";
export { createLayoutedEdges, type LayoutedEdgesSource } from "./projections/layoutedEdges";
export { createParentIds, type ParentIdsSource } from "./projections/parentIds";
