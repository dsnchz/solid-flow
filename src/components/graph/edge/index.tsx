// We distinguish between internal and exported edges
// The internal edges are used directly like custom edges and always get an id, source and target props
// If you import an edge from the library, the id is optional and source and target are not used at all

// @todo: how can we prevent this duplication in ...Edge/ ...EdgeInternal?
// both are quite similar, it's just about 1-2 props that are different
export { default as BezierEdge } from "./BezierEdge";
export { default as BezierEdgeInternal } from "./BezierEdgeInternal";
export { default as EdgeLabel } from "./EdgeLabel";
export { default as EdgeLabelRenderer } from "./EdgeLabelRenderer";
export { default as EdgeWrapper } from "./EdgeWrapper";
export { default as SmoothStepEdge } from "./SmoothStepEdge";
export { default as SmoothStepEdgeInternal } from "./SmoothStepEdgeInternal";
export { default as StepEdge } from "./StepEdge";
export { default as StepEdgeInternal } from "./StepEdgeInternal";
export { default as StraightEdge } from "./StraightEdge";
export { default as StraightEdgeInternal } from "./StraightEdgeInternal";
