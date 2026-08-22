import type {
  ColorModeClass,
  ConnectionState,
  FitBoundsOptions,
  Rect,
  SetCenterOptions,
  SnapGrid,
  Viewport,
  ViewportHelperFunctionOptions,
  XYPosition,
  ZoomInOut,
} from "@xyflow/system";
import type { StoreSetter } from "solid-js";

import type { Edge, EdgeLayouted, FitViewOptions, InternalNode, Node } from "~/types";

import type { ConnectionsRecord } from "./projections/connections";

/**
 * The current selection, as one object: the pair travels together everywhere
 * it is consumed (selection change callbacks, deletion, toolbars).
 */
export type FlowSelection<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly nodes: readonly NodeType[];
  readonly edges: readonly EdgeType[];
};

/**
 * The flow's data graph as one reactive struct — the canonical read surface.
 *
 * Every property read in a tracked scope is a live subscription; the struct
 * itself is a stable identity for the provider's lifetime, so destructuring
 * `const { flow } = useSolidFlow()` is safe (reactivity lives inside the
 * property reads, not in the container). Reads in event handlers are
 * untracked, so `flow.viewport.zoom` inside a handler is already the
 * "imperative getter" — no extra API needed.
 *
 * Keyed lookups are id-keyed records (`flow.internalNodes[id]`) rather than
 * Maps: reactive property reads, per-key granularity, and the shape the
 * underlying projections produce natively.
 */
export type FlowState<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  // ── graph roots (readonly views; writes go through commands) ──
  /** The user node graph. */
  readonly nodes: readonly NodeType[];
  /** The user edge graph. */
  readonly edges: readonly EdgeType[];

  // ── derived graph (projections) ──
  /** Adopted nodes keyed by id: absolute positions, z order, measured dimensions, handle bounds. */
  readonly internalNodes: Record<string, InternalNode<NodeType>>;
  /** Screen-space edge geometry keyed by edge id; edges with missing/unmeasured endpoints have no entry. */
  readonly layoutedEdges: Record<string, EdgeLayouted<EdgeType>>;
  /**
   * The connection index. Keys are built with {@link connectionKey}:
   * `nodeId`, `nodeId-type`, and `nodeId-type-handleId`; each value maps a
   * connection pair key to its {@link HandleConnection}.
   */
  readonly connections: ConnectionsRecord;
  /** The currently selected nodes and edges. */
  readonly selection: FlowSelection<NodeType, EdgeType>;
  /** True once every non-hidden node has been measured. */
  readonly nodesInitialized: boolean;
  /** True once the pan/zoom instance exists. */
  readonly viewportInitialized: boolean;

  // ── viewport & environment ──
  readonly viewport: Viewport;
  /** The flow container's measured width in px. */
  readonly width: number;
  /** The flow container's measured height in px. */
  readonly height: number;
  /** The resolved color mode ("system" resolves to the user's preference). */
  readonly colorMode: ColorModeClass;

  // ── interaction ──
  /** The in-progress connection gesture state. */
  readonly connection: ConnectionState<InternalNode<NodeType>>;
  /** True while a node drag is in progress. */
  readonly dragging: boolean;

  // ── config reflection (read-back of resolved props) ──
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly nodesDraggable: boolean;
  readonly nodesConnectable: boolean;
  readonly elementsSelectable: boolean;
  readonly snapGrid: SnapGrid | undefined;
};

/**
 * The flow's write surface: every public mutation, viewport motion, and
 * geometry helper. Commands are stable identities — destructuring
 * `const { commands } = useSolidFlow()` is safe.
 */
export type FlowCommands<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  // ── viewport ──
  /** Fits the view to the graph (or to `options.nodes`). */
  fitView: (options?: FitViewOptions<NodeType>) => Promise<boolean>;
  /** Fits the view to the given bounds. */
  fitBounds: (bounds: Rect, options?: FitBoundsOptions) => Promise<boolean>;
  /** Zooms in by 1.2. */
  zoomIn: ZoomInOut;
  /** Zooms out by 1 / 1.2. */
  zoomOut: ZoomInOut;
  /** Sets the zoom level. */
  setZoom: (zoomLevel: number, options?: ViewportHelperFunctionOptions) => Promise<boolean>;
  /** Centers the view on the given flow position. */
  setCenter: (x: number, y: number, options?: SetCenterOptions) => Promise<boolean>;
  /** Sets the viewport. */
  setViewport: (viewport: Viewport, options?: ViewportHelperFunctionOptions) => Promise<boolean>;
  /** Pans the viewport by the given delta. */
  panBy: (delta: XYPosition) => Promise<boolean>;
  /** Converts a screen/client position to a flow position. */
  screenToFlowPosition: (
    clientPosition: XYPosition,
    options?: { snapToGrid: boolean },
  ) => XYPosition;
  /** Converts a flow position to a screen/client position. */
  flowToScreenPosition: (flowPosition: XYPosition) => XYPosition;

  // ── graph writes ──
  /** Appends one or many nodes. */
  addNodes: (payload: NodeType[] | NodeType) => void;
  /** Appends one or many edges. */
  addEdges: (payload: EdgeType[] | EdgeType) => void;
  /** Writes the nodes root (canonical Solid store setter — mutate the draft or return a new array). */
  setNodes: StoreSetter<NodeType[]>;
  /** Writes the edges root (canonical Solid store setter — mutate the draft or return a new array). */
  setEdges: StoreSetter<EdgeType[]>;
  /** Merges (or replaces, with `options.replace`) a node by id. */
  updateNode: (
    id: string,
    nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>),
    options?: { replace: boolean },
  ) => void;
  /** Merges (or replaces, with `options.replace`) a node's `data` by id. */
  updateNodeData: (
    id: string,
    dataUpdate: Partial<NodeType["data"]> | ((node: NodeType) => Partial<NodeType["data"]>),
    options?: { replace: boolean },
  ) => void;
  /** Merges (or replaces, with `options.replace`) an edge by id. */
  updateEdge: (
    id: string,
    edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>),
    options?: { replace: boolean },
  ) => void;
  /** Deletes the given nodes/edges plus connected edges, honoring `onBeforeDelete`. */
  deleteElements: (params: {
    nodes?: (Partial<NodeType> & { id: string })[];
    edges?: (Partial<EdgeType> & { id: string })[];
  }) => Promise<{ deletedNodes: NodeType[]; deletedEdges: EdgeType[] }>;

  // ── geometry & measurement ──
  /** All nodes intersecting the given node or rect. */
  getIntersectingNodes: (
    nodeOrRect: NodeType | { id: NodeType["id"] } | Rect,
    partially?: boolean,
    nodesToIntersect?: NodeType[],
  ) => NodeType[];
  /** Whether the given node or rect intersects the area. */
  isNodeIntersecting: (
    nodeOrRect: NodeType | { id: NodeType["id"] } | Rect,
    area: Rect,
    partially?: boolean,
  ) => boolean;
  /** The bounding rect of the given nodes (or node ids). */
  getNodesBounds: (nodes: (NodeType | InternalNode<NodeType> | string)[]) => Rect;
  /** Requests a DOM re-measure of the given node id(s). */
  updateNodeInternals: (id: string | string[]) => void;

  // ── serialization ──
  /** The nodes, edges, and viewport as a plain JSON-safe object. */
  toObject: () => { nodes: NodeType[]; edges: EdgeType[]; viewport: Viewport };
};
