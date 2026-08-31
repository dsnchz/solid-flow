import {
  type ConnectionState,
  evaluateAbsolutePosition,
  getInternalNodesBounds,
  getNodesBounds as systemGetNodesBounds,
  getOverlappingArea,
  getViewportForBounds,
  type Handle,
  infiniteExtent,
  initialConnection,
  type InternalNodeUpdate,
  isRectObject,
  mergeAriaLabelConfig,
  type NodeLookup,
  nodeToRect,
  type PanZoomInstance,
  pointToRendererPoint,
  type Rect,
  type SelectionRect,
  type Transform,
  type Viewport,
} from "@xyflow/system";
import {
  type Accessor,
  createEffect,
  createMemo,
  createProjection,
  createSignal,
  createStore,
  flush,
  merge,
  onCleanup,
  untrack,
} from "solid-js";

import type {
  BuiltInEdgeTypes,
  BuiltInNodeTypes,
  Edge,
  EdgeTypes,
  InternalNode,
  Node,
  NodeTypes,
} from "@/types";
import { isNode } from "@/utils";

import { createElementCommands } from "./commands/elements";
import { createSelectionCommands } from "./commands/selection";
import { createViewportCommands } from "./commands/viewport";
import { createCullingViewport } from "./culling";
import { getDefaultFlowStateProps } from "./defaults";
import { type DragOverlay } from "./dragOverlay";
import { RecordMapFacade } from "./facades";
import type { SolidFlowProps } from "./flowProps";
import { type FlowCommands, type FlowSelection, type FlowState } from "./flowState";
import { createMeasurementIngest } from "./measurementIngest";
import { connectionKey, createConnections } from "./projections/connections";
import { createEdgeLookup } from "./projections/edgeLookup";
import { createInternalNodes, type NodeMeasurements } from "./projections/internalNodes";
import { createLayoutedEdges } from "./projections/layoutedEdges";
import { createParentIds } from "./projections/parentIds";
import { createSelectedIds } from "./projections/selectedIds";
import { type SelectionOverlay } from "./selectionOverlay";
import { SpatialGrid } from "./spatial/grid";
import { createSeededGraphStores } from "./stores/seeding";

/** One measure request: node id plus the DOM element to measure. */
export type MeasureRequestEntry = [string, InternalNodeUpdate];

/**
 * DOM- and component-adjacent dependencies injected into the headless graph.
 * Everything is optional so the graph runs fully headless (tests, servers).
 */
export type FlowStateInjections = {
  /** Resolves the "system" color mode; the browser wiring passes a media query. */
  prefersDark?: Accessor<boolean>;
  /** Built-in node renderers merged beneath the user's `nodeTypes`. */
  initialNodeTypes?: NodeTypes | BuiltInNodeTypes;
  /** Built-in edge renderers merged beneath the user's `edgeTypes`. */
  initialEdgeTypes?: EdgeTypes | BuiltInEdgeTypes;
};

const getInitialViewport = (
  fitView: boolean | undefined,
  initialViewport: Viewport | undefined,
  width: number,
  height: number,
  nodeLookup: NodeLookup,
) => {
  if (fitView && !initialViewport && width && height) {
    const bounds = getInternalNodesBounds(nodeLookup, {
      filter: (node) =>
        !!((node.width || node.initialWidth) && (node.height || node.initialHeight)),
    });
    return getViewportForBounds(bounds, width, height, 0.5, 2, 0.1);
  } else {
    return initialViewport ?? { x: 0, y: 0, zoom: 1 };
  }
};

/**
 * The headless data graph: writable roots, the projection DAG, the internal
 * store surface, and the public FlowState/FlowCommands structs — no DOM, no
 * components. The DOM seams (measurement ingest, media queries, built-in
 * renderer maps) are injected by createSolidFlow; commands invoked by user
 * code may read injected DOM handles (domNode, panZoom) at call time.
 */
export const createFlowState = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: SolidFlowProps<NodeType, EdgeType>,
  injections: FlowStateInjections = {},
) => {
  const _props = merge(getDefaultFlowStateProps(), props);

  const initialNodeTypes = injections.initialNodeTypes ?? ({} as NodeTypes);
  const initialEdgeTypes = injections.initialEdgeTypes ?? ({} as EdgeTypes);

  // "system" color-mode resolution; headless default mirrors the SSR value.
  const prefersDark = injections.prefersDark ?? (() => _props.colorModeSSR === "dark");

  /**********************************************************************************/
  /*                                                                                */
  /*                                 Declare Signals                                */
  /*                                                                                */
  /**********************************************************************************/

  // The config-signal is set by SolidFlow to its props.
  const [config, setConfig] = createSignal(_props);

  const ariaLabelConfig = createMemo(() => mergeAriaLabelConfig(config().ariaLabelConfig));
  const [ariaLiveMessage, setAriaLiveMessage] = createSignal(() => config().ariaLiveMessage);
  const [clickConnectStartHandle, setClickConnectStartHandle] = createSignal<
    Pick<Handle, "id" | "nodeId" | "type"> | undefined
  >(undefined);
  const [connection, setConnection] =
    createSignal<ConnectionState<InternalNode<NodeType>>>(initialConnection);
  const [domNode, setDomNode] = createSignal<HTMLDivElement | null>(null);
  const [dragging, setDragging] = createSignal(false);
  const [elementsSelectable, setElementsSelectable] = createSignal(
    () => config().elementsSelectable,
  );
  const [height, setHeight] = createSignal(() => config().height);
  const minZoom = createMemo(() => config().minZoom);
  const maxZoom = createMemo(() => config().maxZoom);
  const [nodesConnectable, setNodesConnectable] = createSignal(() => config().nodesConnectable);
  const [nodesDraggable, setNodesDraggable] = createSignal(() => config().nodesDraggable);
  const [panZoom, setPanZoom] = createSignal<PanZoomInstance | null>(null);
  const [selectionRect, setSelectionRect] = createSignal<SelectionRect | undefined>();
  const [selectionRectMode, setSelectionRectMode] = createSignal<string | undefined>();
  const [snapGrid, setSnapGrid] = createSignal(() => config().snapGrid);
  const translateExtent = createMemo(() => config().translateExtent ?? infiniteExtent);
  const [width, setWidth] = createSignal(() => config().width);

  // Key flags
  const [selectionKeyPressed, setSelectionKeyPressed] = createSignal(false);
  const [multiselectionKeyPressed, setMultiselectionKeyPressed] = createSignal(false);
  const [deleteKeyPressed, setDeleteKeyPressed] = createSignal(false);
  const [panActivationKeyPressed, setPanActivationKeyPressed] = createSignal(false);
  const [zoomActivationKeyPressed, setZoomActivationKeyPressed] = createSignal(false);

  // Graph-membership seeding: the controlled/uncontrolled policy lives in
  // core/seeding.ts (headless-tested); it creates the two writable roots and
  // the reset/late-adoption effects.
  const { nodesStore, setNodesStore, edgesStore, setEdgesStore } = createSeededGraphStores<
    NodeType,
    EdgeType
  >(props, config);

  // The measurements root: DOM-derived per-node state (measured dimensions,
  // handle bounds), written only by the measurement ingest below. Kept apart
  // from the user graph so a controlled nodes-array reset does not wipe
  // measurements (two-root architecture).
  const [measurementsStore, setMeasurementsStore] = createStore<NodeMeasurements>({});

  // Selection sidecar (solid#3085 composition): flow-driven selection, keyed
  // by element id, joined with user rows at read time (core/selectionOverlay).
  // Selection commands write here first and write through to rows best-effort.
  const [selectionOverlay, setSelectionOverlay] = createStore<{
    nodes: SelectionOverlay;
    edges: SelectionOverlay;
  }>({ nodes: {}, edges: {} });

  // Drag-position sidecar (core/dragOverlay.ts): per-frame gesture positions,
  // joined with rows in the internalNodes projection.
  const [dragOverlay, setDragOverlay] = createStore<DragOverlay>({});

  // The adoption pass as a projection: user nodes joined with measurements
  // into internal nodes (absolute positions, z ordering, handle bounds).
  // Replaces the ReactiveMap + mapArray adoption pipeline — no write side.
  const internalNodes = createInternalNodes<NodeType>({
    get nodes() {
      return nodesStore;
    },
    get measurements() {
      return measurementsStore;
    },
    get selectionOverlay() {
      return selectionOverlay.nodes;
    },
    get dragOverlay() {
      return dragOverlay;
    },
    get nodeOrigin() {
      return config().nodeOrigin;
    },
    get nodeExtent() {
      return config().nodeExtent;
    },
    get elevateNodesOnSelect() {
      return config().elevateNodesOnSelect;
    },
    get zIndexMode() {
      return config().zIndexMode;
    },
    get onError() {
      return config().onFlowError;
    },
  });

  // Read-only Map view over internalNodes for @xyflow/system interop; reads
  // pass through reactively, so tracked scopes subscribe as before.
  const nodeLookup = new RecordMapFacade<InternalNode<NodeType>>(internalNodes);

  const initialViewport = getInitialViewport(
    _props.fitView,
    _props.initialViewport,
    _props.width ?? 0,
    _props.height ?? 0,
    nodeLookup,
  );

  const [viewportStore, setViewportStore] = createStore<Viewport>(
    _props.viewport ?? initialViewport,
  );

  // A controlled viewport prop resets the store; when absent, hold the current value
  createEffect(
    () => config().viewport,
    (next) => {
      if (next) setViewportStore(() => next);
    },
    { defer: true },
  );

  const transform = createMemo(
    () => [viewportStore.x, viewportStore.y, viewportStore.zoom] as Transform,
  );

  // Mirrors upstream adoptUserNodes semantics: true once every non-hidden
  // node has been measured. Reads the measurements root joined with the row
  // (sidecar composition): the row write-through reverts on optimistic
  // stores, so initialization must not depend on it. `in` guard: subscribe
  // even while the key is absent so the first measurement re-runs this.
  const nodesInitialized = createMemo(() => {
    const nodes = nodesStore;
    if (nodes.length === 0) return false;

    for (const node of nodes) {
      if (node.hidden) continue;
      const measurement = node.id in measurementsStore ? measurementsStore[node.id] : undefined;
      const width = measurement?.measured.width ?? node.measured?.width;
      const height = measurement?.measured.height ?? node.measured?.height;
      if (width === undefined || height === undefined) {
        return false;
      }
    }

    return true;
  });

  /**********************************************************************************/
  /*                                                                                */
  /*                                  Declare Store                                 */
  /*                                                                                */
  /**********************************************************************************/

  const resolvedColorMode = createMemo(() => {
    const mode = config().colorMode;
    return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
  });

  // B4 (audit): connection projection memoized — the getter spread the state
  // and ran pointToRendererPoint on every read (ConnectionLine reads it 10x
  // per render, Zoom/Pane once per gesture event).
  const projectedConnection = createMemo(() => {
    const state = connection();
    if (!state.inProgress) return state;
    return {
      ...state,
      to: pointToRendererPoint(state.to, transform()),
    } as ConnectionState<InternalNode<NodeType>>;
  });
  // Per-handle connection reads, equality-cut: `connection` (below) yields a
  // FRESH object every pointermove, so any handle reading through it re-runs
  // per move — at 10k nodes that is ~20k indicator computations per
  // mousemove (measured: the bulk of a 422ms/move connection gesture,
  // spatial-index bench). Handles subscribe to these instead: they change
  // once per gesture (fromHandle), on hover-target changes (toHandle,
  // isValid), never per move.
  const handleIdentityEquals = (
    a: { nodeId: string; type: string; id?: string | null } | null,
    b: { nodeId: string; type: string; id?: string | null } | null,
  ) => a === b || (!!a && !!b && a.nodeId === b.nodeId && a.type === b.type && a.id === b.id);
  const connectionFromHandle = createMemo(() => connection().fromHandle ?? null, {
    equals: handleIdentityEquals,
  });
  // The hover-target as a KEYED record: a toHandle/isValid flip re-runs only
  // the subscribers of the two affected keys (the handle left and the handle
  // entered) instead of every handle in the graph — the difference between a
  // ~400ms hitch and O(2) work when snapping onto a handle at 10k nodes.
  const connectionTargetByHandle = createProjection<Record<string, "valid" | "invalid">>(
    (draft) => {
      const state = connection();
      const toHandle = state.inProgress ? state.toHandle : null;
      const key = toHandle
        ? connectionKey(toHandle.nodeId, toHandle.type, toHandle.id ?? null)
        : null;
      for (const existing of Object.keys(draft)) {
        if (existing !== key) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
          delete draft[existing];
        }
      }
      if (key) draft[key] = state.isValid ? "valid" : "invalid";
    },
    {},
    { key: null },
  );

  // The connection ORIGIN as a keyed record (perf P2): starting a gesture
  // once flipped every handle's possible-target indicator computation
  // (~490ms at 10k). The indicator is now derived from ROOT-level classes in
  // CSS; the only per-handle state left is "am I the origin" (connectingfrom
  // styling) and "am I excluded as a target" (loose mode excludes the origin
  // node's same-id handles) — both keyed, so a gesture start touches the
  // origin's keys instead of every handle. Sources: an in-flight drag
  // connection, else a click-connect origin.
  const connectionOriginByHandle = createProjection<Record<string, "from" | "excluded">>(
    (draft) => {
      const fromHandle = connection().fromHandle ?? clickConnectStartHandle();
      const fromKey = fromHandle
        ? connectionKey(fromHandle.nodeId, fromHandle.type, fromHandle.id ?? null)
        : null;
      const siblingKey = fromHandle
        ? connectionKey(
            fromHandle.nodeId,
            fromHandle.type === "source" ? "target" : "source",
            fromHandle.id ?? null,
          )
        : null;
      for (const existing of Object.keys(draft)) {
        if (existing !== fromKey && existing !== siblingKey) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
          delete draft[existing];
        }
      }
      if (fromKey) draft[fromKey] = "from";
      if (siblingKey) draft[siblingKey] = "excluded";
    },
    {},
    { key: null },
  );

  // B3 (audit): merged renderer maps memoized — the getters below allocated
  // a fresh object PER READ, and every wrapper reads them twice per row.
  const mergedNodeTypes = createMemo(() => ({ ...initialNodeTypes, ...config().nodeTypes }));
  const mergedEdgeTypes = createMemo(() => ({ ...initialEdgeTypes, ...config().edgeTypes }));
  // B5 (audit): selection views memoized — the getters scanned and allocated
  // per read; consumers now share one array identity per selection change.
  // Joined selection views via keyed presence projections (O(changed-row)
  // updates — see core/projections/selectedIds.ts for why the monolithic
  // filter memos had to go). The view memos read the presence RECORDS
  // (membership-level subscription) and resolve rows through the lookups.
  const selectedNodeIds = createSelectedIds(
    () => nodesStore,
    () => selectionOverlay.nodes,
  );
  const selectedEdgeIds = createSelectedIds(
    () => edgesStore,
    () => selectionOverlay.edges,
  );
  const selectedNodesView = createMemo(() =>
    Object.keys(selectedNodeIds)
      .map((id) => nodeLookup.get(id)?.internals.userNode)
      .filter((node): node is NodeType => node !== undefined),
  );
  const selectedEdgesView = createMemo(() =>
    Object.keys(selectedEdgeIds)
      .map((id) => edgeLookup[id])
      .filter((edge): edge is EdgeType => edge !== undefined),
  );

  const store = merge({ width: 0, height: 0 }, config, {
    get ariaLabelConfig() {
      return ariaLabelConfig();
    },
    get ariaLiveMessage() {
      return ariaLiveMessage();
    },
    get clickConnectStartHandle() {
      return clickConnectStartHandle();
    },
    get colorMode() {
      return resolvedColorMode();
    },
    get connection() {
      return projectedConnection();
    },
    get connectionFromHandle() {
      return connectionFromHandle();
    },
    get connectionTargetByHandle() {
      return connectionTargetByHandle;
    },
    get connectionOriginByHandle() {
      return connectionOriginByHandle;
    },
    get domNode() {
      return domNode();
    },
    get dragging() {
      return dragging();
    },
    get edgeTypes() {
      return mergedEdgeTypes() as EdgeTypes;
    },
    get elementsSelectable() {
      return elementsSelectable();
    },
    get height() {
      return height();
    },
    get lib() {
      /*
       * Made this a derived store get value to prevent overwriting the value. This value is crucial
       * for the underlying @xyflow/system library to identify elements as this is the prefix we use
       * for all the CSS class names across the library.
       */
      return "solid" as const;
    },
    get onError() {
      return config().onFlowError;
    },
    get maxZoom() {
      return maxZoom();
    },
    get minZoom() {
      return minZoom();
    },
    get edges(): EdgeType[] {
      return edgesStore as EdgeType[];
    },
    get nodes(): NodeType[] {
      return nodesStore as NodeType[];
    },
    get nodesConnectable() {
      return nodesConnectable();
    },
    get nodesDraggable() {
      return nodesDraggable();
    },
    get nodeTypes() {
      return mergedNodeTypes() as NodeTypes;
    },
    get panZoom() {
      return panZoom();
    },
    get selectedNodes() {
      return selectedNodesView();
    },
    get selectedEdges() {
      return selectedEdgesView();
    },
    get selectionRect() {
      return selectionRect();
    },
    get selectionRectMode() {
      return selectionRectMode();
    },
    get snapGrid() {
      return snapGrid();
    },
    get viewport() {
      return viewportStore;
    },
    get viewportInitialized() {
      return panZoom() !== null;
    },
    get nodesInitialized() {
      return nodesInitialized();
    },
    get visibleEdgeIds() {
      return visibleEdgeIds();
    },
    get visibleNodeIds() {
      return visibleNodeIds();
    },
    get cullingViewport() {
      return cullingViewport();
    },
    get transform() {
      return transform();
    },
    get translateExtent() {
      return translateExtent();
    },
    get width() {
      return width();
    },

    // key press flags
    get selectionKeyPressed() {
      return selectionKeyPressed();
    },
    get multiselectionKeyPressed() {
      return multiselectionKeyPressed();
    },
    get deleteKeyPressed() {
      return deleteKeyPressed();
    },
    get panActivationKeyPressed() {
      return panActivationKeyPressed();
    },
    get zoomActivationKeyPressed() {
      return zoomActivationKeyPressed();
    },
  });

  /**********************************************************************************/
  /*                                                                                */
  /*                               Visible Nodes/Edges                              */
  /*                                                                                */
  /**********************************************************************************/

  // The #15 culling viewport: quantized/overscanned flow-space rect, null
  // while the container is unmeasured. Two consumers: per-element culled
  // memos in NodeWrapper/EdgeWrapper (always-on CSS tier), and the
  // renderers' per-row unmount gates (opt-in onlyRenderVisibleElements
  // tier, design doc §4 + bench round 6).
  const cullingViewport = createCullingViewport({
    get width() {
      return store.width;
    },
    get height() {
      return store.height;
    },
    get transform() {
      return transform();
    },
  });

  // Structural read only (record keys = node ids): row-level changes — e.g.
  // the dragged node's row rebuilding every move — must not re-run this.
  // Always the FULL id list: the CSS tier hides elements without changing
  // membership, and the opt-in unmount tier gates per row INSIDE the
  // renderer's <For> (a Show around each wrapper) so this list stays stable.
  // Membership from the seeded (user-facing) store, NOT the projection
  // record: a derived record's ENUMERATION does not surface an optimistic
  // membership edit mid-action, while direct row reads pierce the overlay
  // (#3085; spike 30). Renderers guard per-row against not-yet-materialized
  // projection rows.
  const visibleNodeIds = createMemo(() => nodesStore.map((node) => node.id));

  // Which nodes currently have children (reactive "is parent" answers)
  const parentIds = createParentIds<NodeType>({
    get nodes() {
      return store.nodes;
    },
  });

  // Edge-derived indexes (core projections): fully derived from the edges
  // store — no write side, no GC, no adoption pipeline.
  const edgeLookup = createEdgeLookup<EdgeType>({
    get edges() {
      return store.edges;
    },
  });

  const connections = createConnections<EdgeType>({
    get edges() {
      return store.edges;
    },
  });

  // Edge layout join (core projection): id-keyed record, row identity stable
  // across derive re-runs. Replaces the mapArray layout effect + ReactiveMap.
  const layoutedEdges = createLayoutedEdges<NodeType, EdgeType>({
    get selectionOverlay() {
      return selectionOverlay.edges;
    },
    get edges() {
      return store.edges;
    },
    get connectionMode() {
      return store.connectionMode;
    },
    get defaultEdgeOptions() {
      return store.defaultEdgeOptions;
    },
    get elevateEdgesOnSelect() {
      return store.elevateEdgesOnSelect;
    },
    get zIndexMode() {
      return store.zIndexMode;
    },
    get onError() {
      return store.onError;
    },
    nodeLookup,
  });

  // Same membership-vs-layout split as visibleNodeIds; unlayouted edges are
  // filtered by the renderer's per-row guard (their layouted row is null).
  const visibleEdgeIds = createMemo(() => edgesStore.map((edge) => edge.id));

  // Named for what it returns: the LAYOUTED row (geometry joined in).
  // Raw user edges live in `edgeLookup` — near-identical names once made
  // this a shape trap (audit D2).
  // `in` guard: subscribe even while the key is absent, so a caller waiting
  // on an edge's layout (the renderer's mount guard) re-runs when it lands.
  const getLayoutedEdge = (id: string) => (id in layoutedEdges ? layoutedEdges[id] : undefined);

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Methods                                    */
  /*                                                                                */
  /**********************************************************************************/

  // ── viewport command group (core/commands/viewport.ts): camera movement
  // and coordinate conversion ──
  const viewportCommands = createViewportCommands<NodeType, EdgeType>({
    store,
    nodeLookup,
    defaultFitViewOptions: () => config().fitViewOptions,
  });
  const { fitView, zoomIn, zoomOut, setCenter, panBy } = viewportCommands;

  const resetStoreValues = () => {
    // NOTE: should we reset to the config()-values instead?
    setDragging(false);
    setSelectionRect(undefined);
    setSelectionRectMode(undefined);
    setSelectionKeyPressed(false);
    setMultiselectionKeyPressed(false);
    setDeleteKeyPressed(false);
    setPanActivationKeyPressed(false);
    setZoomActivationKeyPressed(false);
    setConnection({ ...initialConnection });
    setClickConnectStartHandle(undefined);
    setViewportStore(() => config().initialViewport ?? { x: 0, y: 0, zoom: 1 });
    setAriaLiveMessage("");
    setSnapGrid(undefined);
  };

  // ── element command group (core/commands/elements.ts): structural and
  // field mutations of nodes/edges, plus the gesture-driven writers ──
  const elementCommands = createElementCommands<NodeType, EdgeType>({
    store,
    setNodesStore,
    setEdgesStore,
    setSelectionOverlay,
    setDragOverlay,
    nodeLookup,
    // Presence check only — referencing the store proxy is not a row read,
    // so a still-pending async-seeded store is safe here.
    controlledEdges: () => untrack(() => config().edges) !== undefined,
  });
  const { addEdge, updateNodePositions } = elementCommands;

  let initialFitViewApplied = false;
  let initialNodesMeasured = false;

  const applyInitialFitView = (initialFitView: boolean) => {
    initialFitViewApplied = !initialFitView;
  };

  // The initial fitView needs both the measured nodes (reported through
  // requestUpdateNodeInternals) and the container dimensions (reported through the
  // resize observer). Their order is not guaranteed, so whichever arrives last fires it.
  const tryInitialFitView = () => {
    if (initialFitViewApplied || !initialNodesMeasured) return;
    if (!untrack(() => store.panZoom && store.width && store.height)) return;

    initialFitViewApplied = true;
    void untrack(() => fitView());
  };

  // ── measurement ingest (core/measurementIngest.ts): DOM-pass writes into
  // the data graph + the measurements GC effect ──
  const { applyMeasurementWrites, applyNodeChanges } = createMeasurementIngest<NodeType>({
    setMeasurementsStore,
    setNodesStore,
    nodes: () => nodesStore,
  });

  /** Marks the first measuring pass complete (may trigger the initial fitView). */
  const markInitialNodesMeasured = () => {
    initialNodesMeasured = true;
    tryInitialFitView();
  };

  // The DOM measuring pass is registered by the wiring layer (createSolidFlow)
  // via setMeasureRequester; headless usage leaves it a no-op.
  let requestMeasure: (entries: MeasureRequestEntry[]) => void = () => {};
  const setMeasureRequester = (fn: (entries: MeasureRequestEntry[]) => void) => {
    requestMeasure = fn;
  };

  const stableSetViewport = (viewport: Viewport) => setViewportStore(() => viewport);

  // ── selection command group (core/commands/selection.ts) ──
  const {
    unselectNodesAndEdges,
    addSelectedNodes,
    addSelectedEdges,
    handleNodeSelection,
    handleEdgeSelection,
    moveSelectedNodes,
    applySelectionSets,
  } = createSelectionCommands<NodeType, EdgeType>({
    store,
    setNodesStore,
    setEdgesStore,
    setSelectionRect,
    setSelectionRectMode,
    nodeLookup,
    edgeLookup,
    updateNodePositions,
    selectionOverlay,
    setSelectionOverlay,
  });

  // Overlay release (confirm-then-release, core/selectionOverlay.ts): delete
  // an entry once the row STABLY carries the written value — the write-through
  // landed, so the row (and later user writes) can govern. Confirmation is
  // re-verified on a macrotask: an optimistic write is briefly visible before
  // its transaction reverts it, and effects observe that transient — only a
  // post-settle re-check separates "landed" (plain store) from "reverted"
  // (optimistic store).
  //
  // The compute reads rows through the proxies CAPTURED IN THE ENTRIES —
  // never through nodeLookup/edgeLookup: pulling a derived keyed record
  // inside the write flush triggered an O(sources) marking wave (~130ms
  // @10k, the residual of bench round 12b). Entries for rows that left the
  // graph are swept in the deferred timer (off-frame), where record pulls
  // are harmless.
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(releaseTimer));
  createEffect(
    () => {
      const candidates: ["nodes" | "edges", string][] = [];
      for (const id in selectionOverlay.nodes) {
        const entry = selectionOverlay.nodes[id]!;
        if (!!entry.row.selected === entry.value) candidates.push(["nodes", id]);
      }
      for (const id in selectionOverlay.edges) {
        const entry = selectionOverlay.edges[id]!;
        if (!!entry.row.selected === entry.value) candidates.push(["edges", id]);
      }
      const dragCandidates: string[] = [];
      for (const id in dragOverlay) {
        const entry = dragOverlay[id]!;
        if (
          !entry.dragging &&
          entry.row.position.x === entry.position.x &&
          entry.row.position.y === entry.position.y
        ) {
          dragCandidates.push(id);
        }
      }
      return { candidates, dragCandidates };
    },
    ({ candidates, dragCandidates }) => {
      if (!candidates.length && !dragCandidates.length) return;
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        const confirmed = candidates.filter(([kind, id]) => {
          const entry = selectionOverlay[kind][id];
          return entry !== undefined && !!entry.row.selected === entry.value;
        });
        const dragConfirmed = dragCandidates.filter((id) => {
          const entry = dragOverlay[id];
          return (
            entry !== undefined &&
            !entry.dragging &&
            entry.row.position.x === entry.position.x &&
            entry.row.position.y === entry.position.y
          );
        });
        // Off-frame sweep: entries whose rows left the graph. Record pulls
        // are fine here — no flush is in flight.
        const goneSel: ["nodes" | "edges", string][] = [];
        for (const id in selectionOverlay.nodes) {
          if (!nodeLookup.has(id)) goneSel.push(["nodes", id]);
        }
        for (const id in selectionOverlay.edges) {
          if (!(id in edgeLookup)) goneSel.push(["edges", id]);
        }
        const goneDrag: string[] = [];
        for (const id in dragOverlay) {
          if (!nodeLookup.has(id)) goneDrag.push(id);
        }
        if (confirmed.length || goneSel.length) {
          setSelectionOverlay((draft) => {
            for (const [kind, id] of [...confirmed, ...goneSel]) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete draft[kind][id];
            }
          });
        }
        if (dragConfirmed.length || goneDrag.length) {
          setDragOverlay((draft) => {
            for (const id of [...dragConfirmed, ...goneDrag]) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete draft[id];
            }
          });
        }
        if (confirmed.length || dragConfirmed.length || goneSel.length || goneDrag.length) flush();
      }, 0);
    },
  );

  const cancelConnection = () => {
    setConnection({ ...initialConnection });
  };

  const reset = () => {
    resetStoreValues();
    unselectNodesAndEdges();
  };

  /**********************************************************************************/
  /*                                                                                */
  /*                           FlowState / FlowCommands                             */
  /*                                                                                */
  /**********************************************************************************/

  // The public read surface: the whole data graph as ONE reactive struct.
  // `flow` and `selection` are stable identities — reactivity lives inside
  // the property reads — so consumers can destructure them safely.
  const selection: FlowSelection<NodeType, EdgeType> = {
    get nodes(): readonly NodeType[] {
      return store.selectedNodes;
    },
    get edges(): readonly EdgeType[] {
      return store.selectedEdges;
    },
  };

  const flow: FlowState<NodeType, EdgeType> = {
    get nodes(): readonly NodeType[] {
      return store.nodes;
    },
    get edges(): readonly EdgeType[] {
      return store.edges;
    },
    get internalNodes() {
      return internalNodes;
    },
    get layoutedEdges() {
      return layoutedEdges;
    },
    get connections() {
      return connections;
    },
    selection,
    get nodesInitialized() {
      return store.nodesInitialized;
    },
    get viewportInitialized() {
      return store.viewportInitialized;
    },
    get viewport() {
      return store.viewport;
    },
    get width() {
      return store.width;
    },
    get height() {
      return store.height;
    },
    get colorMode() {
      return store.colorMode;
    },
    get connection() {
      return store.connection;
    },
    get dragging() {
      return store.dragging;
    },
    get minZoom() {
      return store.minZoom;
    },
    get maxZoom() {
      return store.maxZoom;
    },
    get nodesDraggable() {
      return store.nodesDraggable;
    },
    get nodesConnectable() {
      return store.nodesConnectable;
    },
    get elementsSelectable() {
      return store.elementsSelectable;
    },
    get snapGrid() {
      return store.snapGrid;
    },
  };

  // The public write surface. Implementations live here (not in the hook) so
  // the struct is the canonical capability surface and hooks stay aliases.
  // A microtask-lifetime spatial grid over node rects: always rebuilt at
  // most once per task (no invalidation seams to miss — geometry writes in
  // the same task were already visible when the first query built it, and
  // the next task rebuilds). Untracked: this is a pull API, not a
  // subscription (a reactive index would recreate the round-6
  // central-collection anti-pattern).
  let intersectionGrid: SpatialGrid | null = null;
  let intersectionRows: Map<string, NodeType> | null = null;
  const queryIntersectionCandidates = (rect: Rect): NodeType[] =>
    untrack(() => {
      if (!intersectionGrid) {
        const grid = new SpatialGrid(300);
        const rows = new Map<string, NodeType>();
        for (const node of store.nodes) {
          const internalNode = nodeLookup.get(node.id);
          if (!internalNode) continue;
          grid.insert(node.id, nodeToRect(internalNode));
          rows.set(node.id, node);
        }
        intersectionGrid = grid;
        intersectionRows = rows;
        queueMicrotask(() => {
          intersectionGrid = null;
          intersectionRows = null;
        });
      }
      const rows = intersectionRows!;
      const result: NodeType[] = [];
      for (const id of intersectionGrid.queryRect(rect)) {
        const row = rows.get(id);
        if (row) result.push(row);
      }
      return result;
    });

  const getNodeRect = (node: NodeType | { id: NodeType["id"] }): Rect | null => {
    const nodeToUse = isNode<NodeType>(node) ? node : nodeLookup.get(node.id);
    if (!nodeToUse) return null;
    const position = nodeToUse.parentId
      ? evaluateAbsolutePosition(
          nodeToUse.position,
          nodeToUse.measured,
          nodeToUse.parentId,
          nodeLookup,
          store.nodeOrigin,
        )
      : nodeToUse.position;

    const nodeWithPosition = {
      ...nodeToUse,
      position,
      width: nodeToUse.measured?.width ?? nodeToUse.width,
      height: nodeToUse.measured?.height ?? nodeToUse.height,
    };

    return nodeToRect(nodeWithPosition);
  };

  const commands: FlowCommands<NodeType, EdgeType> = {
    fitView: viewportCommands.fitView,
    fitBounds: viewportCommands.fitBounds,
    zoomIn,
    zoomOut,
    setZoom: viewportCommands.setZoom,
    setCenter,
    setViewport: viewportCommands.setViewport,
    panBy,
    screenToFlowPosition: viewportCommands.screenToFlowPosition,
    flowToScreenPosition: viewportCommands.flowToScreenPosition,
    addNodes: elementCommands.addNodes,
    addEdges: elementCommands.addEdges,
    setNodes: setNodesStore,
    setEdges: setEdgesStore,
    updateNode: elementCommands.updateNode,
    updateNodeData: elementCommands.updateNodeData,
    updateEdge: elementCommands.updateEdge,
    deleteElements: elementCommands.deleteElements,
    getIntersectingNodes: (nodeOrRect, partially = true, nodesToIntersect) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) return [];

      // RFC-4239 win #2: with no explicit subset, narrow candidates through
      // the microtask-cached grid — collision patterns calling this per
      // dragged node per frame share ONE build and drop from O(n) per call
      // to O(candidates). The exact predicate below is unchanged.
      const candidates = nodesToIntersect ?? queryIntersectionCandidates(nodeRect);

      return candidates.filter((n) => {
        const internalNode = nodeLookup.get(n.id);
        if (!internalNode || (!isRect && n.id === nodeOrRect.id)) {
          return false;
        }

        const currNodeRect = nodeToRect(internalNode);
        const overlappingArea = getOverlappingArea(currNodeRect, nodeRect);
        const partiallyVisible = partially && overlappingArea > 0;

        return partiallyVisible || overlappingArea >= nodeRect.width * nodeRect.height;
      });
    },
    isNodeIntersecting: (nodeOrRect, area, partially = true) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) return false;

      const overlappingArea = getOverlappingArea(nodeRect, area);
      const partiallyVisible = partially && overlappingArea > 0;

      return partiallyVisible || overlappingArea >= nodeRect.width * nodeRect.height;
    },
    getNodesBounds: (nodesToMeasure) => {
      return systemGetNodesBounds(nodesToMeasure, { nodeLookup, nodeOrigin: store.nodeOrigin });
    },
    updateNodeInternals: (id) => {
      const updateIds = Array.isArray(id) ? id : [id];
      const updates: MeasureRequestEntry[] = [];

      for (const updateId of updateIds) {
        const nodeElement = store.domNode?.querySelector<HTMLDivElement>(
          `.solid-flow__node[data-id="${updateId}"]`,
        );
        if (!nodeElement) continue;

        updates.push([updateId, { id: updateId, nodeElement, force: true }]);
      }

      requestMeasure(updates);
    },
    toObject: elementCommands.toObject,
  };

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Effects                                    */
  /*                                                                                */
  /**********************************************************************************/

  // The initial fitView also needs the measured nodes, which arrive through
  // requestUpdateNodeInternals (imperative); this effect covers the case where
  // the container/panZoom side is what arrives last.
  createEffect(
    () => Boolean(width() && height() && panZoom()),
    (ready) => {
      if (ready) tryInitialFitView();
    },
  );

  // External system: keep the d3 zoom transform in sync with the viewport
  // store. The leaves are read in the compute so deep writes retrigger.
  createEffect(
    () => ({
      panZoom: store.panZoom,
      viewport: { x: store.viewport.x, y: store.viewport.y, zoom: store.viewport.zoom },
    }),
    ({ panZoom, viewport }) => {
      panZoom?.syncViewport(viewport);
    },
  );

  // panZoom is part of each compute: the instance lands after mount and each
  // new instance must receive the current values.
  createEffect(
    () => ({ panZoom: panZoom(), extent: [store.minZoom, store.maxZoom] as [number, number] }),
    ({ panZoom, extent }) => {
      panZoom?.setScaleExtent(extent);
    },
  );

  createEffect(
    () => ({ panZoom: panZoom(), extent: store.translateExtent }),
    ({ panZoom, extent }) => {
      panZoom?.setTranslateExtent(extent);
    },
  );

  return {
    store,
    flow,
    commands,
    internalNodes,
    layoutedEdges,
    nodeLookup,
    edgeLookup,
    parentIds,
    connections,
    actions: {
      getLayoutedEdge,
      applyInitialFitView,
      applyMeasurementWrites,
      applyNodeChanges,
      markInitialNodesMeasured,
      setMeasureRequester,
      setAriaLiveMessage,
      setClickConnectStartHandle,
      setConfig,
      setConnection,
      setDeleteKeyPressed,
      setDomNode,
      setDragging,
      setEdges: setEdgesStore,
      setElementsSelectable,
      setHeight,
      setMultiselectionKeyPressed,
      setNodes: setNodesStore,
      setNodesConnectable,
      setNodesDraggable,
      setPanActivationKeyPressed,
      setPanZoom,
      setSelectionKeyPressed,
      setSelectionRect,
      setSelectionRectMode,
      setViewport: stableSetViewport,
      setWidth,
      setZoomActivationKeyPressed,

      addEdge,
      updateNodePositions,
      zoomIn,
      zoomOut,
      fitView,
      setCenter,

      unselectNodesAndEdges,
      addSelectedNodes,
      applySelectionSets,
      addSelectedEdges,
      handleNodeSelection,
      handleEdgeSelection,
      moveSelectedNodes,
      panBy,

      cancelConnection,
      reset,
    } as const,
  } as const;
};
