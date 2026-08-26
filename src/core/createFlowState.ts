import {
  addEdge as systemAddEdge,
  calculateNodePosition,
  type Connection,
  type ConnectionState,
  errorMessages,
  evaluateAbsolutePosition,
  fitViewport,
  getElementsToRemove,
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
  type NodeDimensionChange,
  type NodeDragItem,
  type NodeLookup,
  type NodePositionChange,
  nodeToRect,
  panBy as panBySystem,
  type PanZoomInstance,
  pointToRendererPoint,
  type Rect,
  rendererPointToPoint,
  type SelectionRect,
  type SetCenterOptions,
  snapPosition,
  type Transform,
  type Viewport,
  type ViewportHelperFunctionOptions,
  type XYPosition,
} from "@xyflow/system";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  createStore,
  flush,
  merge,
  snapshot,
  untrack,
} from "solid-js";

import type {
  BuiltInEdgeTypes,
  BuiltInNodeTypes,
  Edge,
  EdgeTypes,
  FitViewOptions,
  InternalNode,
  Node,
  NodeGraph,
  NodeTypes,
} from "@/types";
import { isEdge, isEdgeSelectable, isNode } from "@/utils";

import { createCullingViewport } from "./culling";
import { getDefaultFlowStateProps } from "./defaults";
import { RecordMapFacade } from "./facades";
import type { SolidFlowProps } from "./flowProps";
import { type FlowCommands, type FlowSelection, type FlowState } from "./flowState";
import { createConnections } from "./projections/connections";
import { createEdgeLookup } from "./projections/edgeLookup";
import {
  createInternalNodes,
  type NodeMeasurements,
  type NodeMeasurementWrite,
} from "./projections/internalNodes";
import { createLayoutedEdges } from "./projections/layoutedEdges";
import { createParentIds } from "./projections/parentIds";

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

  const [ariaLabelConfig, setAriaLabelConfig] = createSignal(() =>
    mergeAriaLabelConfig(config().ariaLabelConfig),
  );
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
  const [minZoom, _setMinZoom] = createSignal<number>(() => config().minZoom);
  const [maxZoom, _setMaxZoom] = createSignal<number>(() => config().maxZoom);
  const [nodesConnectable, setNodesConnectable] = createSignal(() => config().nodesConnectable);
  const [nodesDraggable, setNodesDraggable] = createSignal(() => config().nodesDraggable);
  const [panZoom, setPanZoom] = createSignal<PanZoomInstance | null>(null);
  const [selectionRect, setSelectionRect] = createSignal<SelectionRect | undefined>();
  const [selectionRectMode, setSelectionRectMode] = createSignal<string | undefined>();
  const [snapGrid, setSnapGrid] = createSignal(() => config().snapGrid);
  const [translateExtent, _setTranslateExtent] = createSignal(
    () => config().translateExtent ?? infiniteExtent,
  );
  const [width, setWidth] = createSignal(() => config().width);

  // Key flags
  const [selectionKeyPressed, setSelectionKeyPressed] = createSignal(false);
  const [multiselectionKeyPressed, setMultiselectionKeyPressed] = createSignal(false);
  const [deleteKeyPressed, setDeleteKeyPressed] = createSignal(false);
  const [panActivationKeyPressed, setPanActivationKeyPressed] = createSignal(false);
  const [zoomActivationKeyPressed, setZoomActivationKeyPressed] = createSignal(false);

  // Controlled vs uncontrolled, PER AXIS (React Flow defaultNodes/
  // defaultEdges parity). Controlled: the user's array/store owns membership
  // and the reset effects below track it. Uncontrolled: defaults seed the
  // flow-owned store once and commands/completed connections own membership
  // (they already write these stores; the only controlled-mode difference is
  // that a re-seed clobbers them). Mode is observable as
  // `config().nodes !== undefined` — nodes/edges deliberately have NO merged
  // default, so absence survives to here. A provider-created flow starts
  // with neither and adopts whichever axis the inner SolidFlow supplies via
  // setConfig (controlled arrays through the reset effects; defaults through
  // the one-shot adoption effect below).
  if (props.nodes !== undefined && props.defaultNodes !== undefined) {
    console.warn(
      "[solid-flow] Both `nodes` and `defaultNodes` were supplied; `nodes` wins and the flow is controlled. Pass one or the other.",
    );
  }
  if (props.edges !== undefined && props.defaultEdges !== undefined) {
    console.warn(
      "[solid-flow] Both `edges` and `defaultEdges` were supplied; `edges` wins and the flow is controlled. Pass one or the other.",
    );
  }

  // Plain writable stores seeded from the user's graph, reset by the effects
  // below when the supplied array identity changes (matching 1.x, where the
  // backing store was recreated whenever the accessor value changed); all
  // other writes are local drafts. NOT the projection form of createStore:
  // deriving from a store-proxy source rewraps every element on structural
  // writes, so a single addEdge/addNode would churn all row identities and
  // recreate the whole mapArray pipeline (verified empirically on rc.1).
  // Defaults are shallow-copied: the flow owns membership of its store and
  // must not splice the caller's array (runtime fields still write onto the
  // shared row objects, same as controlled mode).
  const [nodesStore, setNodesStore] = createStore<NodeType[]>(
    (props.nodes ?? [...(props.defaultNodes ?? [])]) as NodeType[],
  );
  const [edgesStore, setEdgesStore] = createStore<EdgeType[]>(
    (props.edges ?? [...(props.defaultEdges ?? [])]) as EdgeType[],
  );

  // Whether each axis has consumed its one-time seed (from either prop).
  // Only a provider-created flow can still adopt later, via setConfig.
  let nodeSeedAdopted = props.nodes !== undefined || props.defaultNodes !== undefined;
  let edgeSeedAdopted = props.edges !== undefined || props.defaultEdges !== undefined;

  // The measurements root: DOM-derived per-node state (measured dimensions,
  // handle bounds), written only by the measurement ingest below. Kept apart
  // from the user graph so a controlled nodes-array reset does not wipe
  // measurements (two-root architecture).
  const [measurementsStore, setMeasurementsStore] = createStore<NodeMeasurements>({});

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

  // Controlled-graph resets. Track the supplied arrays STRUCTURALLY (length +
  // element identity), not by reference: when the prop is a store (the
  // documented createNodeStore pattern), its proxy identity never changes, so
  // a wholesale replacement (`setNodes(() => nodes.map(...))`) would
  // otherwise never reach an adopted flow's internal root (the provider
  // seeds it before the component's props arrive). Field-level draft writes
  // keep element identity, skip the reset, and flow through the shared node
  // objects. The `{ next }` wrapper defeats the effect's equals check — the
  // proxy identity is stable even when the contents changed.
  // An undefined axis is uncontrolled (or a provider flow not yet adopted):
  // never re-seed it — defaults are initial-only and the flow owns
  // membership. A provider flow adopting a controlled axis flips
  // undefined -> array here and seeds through the same path.
  createEffect(
    () => {
      const next = config().nodes as NodeType[] | undefined;
      if (next) for (const node of next) void node;
      return { next };
    },
    ({ next }) => {
      if (!next) return;
      nodeSeedAdopted = true;
      setNodesStore(() => next);
    },
    { defer: true },
  );
  createEffect(
    () => {
      const next = config().edges as EdgeType[] | undefined;
      if (next) for (const edge of next) void edge;
      return { next };
    },
    ({ next }) => {
      if (!next) return;
      edgeSeedAdopted = true;
      setEdgesStore(() => next);
    },
    { defer: true },
  );
  // One-shot late adoption of DEFAULTS for provider-created flows: the
  // provider seeded this store before the inner SolidFlow's props existed,
  // so its defaultNodes/defaultEdges arrive via setConfig. Each axis adopts
  // at most once, and never over a controlled axis.
  createEffect(
    () => ({ nodes: config().defaultNodes, edges: config().defaultEdges }),
    ({ nodes: defaultNodes, edges: defaultEdges }) => {
      if (defaultNodes && !nodeSeedAdopted && config().nodes === undefined) {
        nodeSeedAdopted = true;
        setNodesStore(() => [...defaultNodes] as NodeType[]);
      }
      if (defaultEdges && !edgeSeedAdopted && config().edges === undefined) {
        edgeSeedAdopted = true;
        setEdgesStore(() => [...defaultEdges] as EdgeType[]);
      }
    },
    { defer: true },
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

  // Mirrors upstream adoptUserNodes semantics: true once every non-hidden node has been measured
  const nodesInitialized = createMemo(() => {
    const nodes = nodesStore;
    if (nodes.length === 0) return false;

    for (const node of nodes) {
      if (node.hidden) continue;
      if (node.measured?.width === undefined || node.measured?.height === undefined) {
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
  // B3 (audit): merged renderer maps memoized — the getters below allocated
  // a fresh object PER READ, and every wrapper reads them twice per row.
  const mergedNodeTypes = createMemo(() => ({ ...initialNodeTypes, ...config().nodeTypes }));
  const mergedEdgeTypes = createMemo(() => ({ ...initialEdgeTypes, ...config().edgeTypes }));
  // B5 (audit): selection views memoized — the getters scanned and allocated
  // per read; consumers now share one array identity per selection change.
  const selectedNodesView = createMemo(() => nodesStore.filter((node) => node.selected));
  const selectedEdgesView = createMemo(() => edgesStore.filter((edge) => edge.selected));

  const store = merge({ width: 0, height: 0 }, config, {
    get _colorMode() {
      return config().colorMode;
    },
    get _colorModeSSR() {
      return config().colorModeSSR;
    },
    get _connection() {
      return connection();
    },
    get _nodeTypes() {
      return config().nodeTypes;
    },
    get _edgeTypes() {
      return config().edgeTypes;
    },
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
      return this._colorMode === "system" ? (prefersDark() ? "dark" : "light") : this._colorMode;
    },
    get connection() {
      return projectedConnection();
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
  const visibleNodeIds = createMemo(() => Object.keys(internalNodes));

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

  const visibleEdgeIds = createMemo(() => Object.keys(layoutedEdges));

  const getEdge = (id: string) => layoutedEdges[id];

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Methods                                    */
  /*                                                                                */
  /**********************************************************************************/

  const fitView = async (options?: FitViewOptions<NodeType>) => {
    if (!store.panZoom) return false;

    const result = await fitViewport(
      {
        nodes: nodeLookup,
        width: store.width,
        height: store.height,
        panZoom: store.panZoom,
        minZoom: store.minZoom,
        maxZoom: store.maxZoom,
      },
      options ?? config().fitViewOptions,
    );

    return result;
  };

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

  const addEdge = (edgeParams: EdgeType | Connection) => {
    setEdgesStore((edges) => {
      const next = systemAddEdge(edgeParams, edges as EdgeType[]);
      // systemAddEdge returns the same array when the edge is invalid/duplicate
      if (next !== edges) {
        edges.push(next[next.length - 1]!);
      }
      return undefined;
    });
  };

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

  const updateNodePositions = (
    nodeDragItems: Map<string, Pick<NodeDragItem, "position">>,
    dragging = false,
  ) => {
    setNodesStore((nodes) => {
      for (const node of nodes) {
        if (!nodeDragItems.has(node.id)) continue;
        node.dragging = dragging;
        node.position = nodeDragItems.get(node.id)!.position;
      }
      return undefined;
    });
  };

  // ── measurement ingest seams (the DOM side lives in createSolidFlow) ──

  /** Applies a DOM measuring pass's writes to the measurements root. */
  const applyMeasurementWrites = (writes: NodeMeasurementWrite[]) => {
    setMeasurementsStore((draft) => {
      for (const write of writes) {
        if (write.hidden) {
          // Clear handle bounds (keep dimensions) so unhiding re-measures.
          const entry = draft[write.id];
          if (entry) entry.handleBounds = undefined;
        } else {
          draft[write.id] = { measured: write.measured, handleBounds: write.handleBounds };
        }
      }
      return undefined;
    });
  };

  /** Applies measured dimension/position changes back to the user graph. */
  const applyNodeChanges = (changes: (NodeDimensionChange | NodePositionChange)[]) => {
    if (changes.length === 0) return;

    setNodesStore((nodes) => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

      // Applied in order: parent expansion can emit BOTH a position and a
      // dimensions change for the same node, and both must land.
      for (const change of changes) {
        const node = nodeById.get(change.id);
        if (!node) continue;

        switch (change.type) {
          case "dimensions": {
            if (change.setAttributes) {
              node.width = change.dimensions?.width ?? node.width;
              node.height = change.dimensions?.height ?? node.height;
            }

            node.measured = { ...node.measured, ...change.dimensions };
            break;
          }
          case "position":
            node.position = change.position ?? node.position;
            break;
        }
      }
      return undefined;
    });
  };

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

  const zoomBy = async (factor: number, options?: ViewportHelperFunctionOptions) => {
    return store.panZoom ? store.panZoom.scaleBy(factor, options) : false;
  };

  const zoomIn = (options?: ViewportHelperFunctionOptions) => zoomBy(1.2, options);
  const zoomOut = (options?: ViewportHelperFunctionOptions) => zoomBy(1 / 1.2, options);

  const setCenter = async (x: number, y: number, options?: SetCenterOptions) => {
    const nextZoom = typeof options?.zoom !== "undefined" ? options.zoom : store.maxZoom;
    const currentPanZoom = store.panZoom;

    if (!currentPanZoom) {
      return Promise.resolve(false);
    }

    await currentPanZoom.setViewport(
      {
        x: store.width / 2 - x * nextZoom,
        y: store.height / 2 - y * nextZoom,
        zoom: nextZoom,
      },
      { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate },
    );

    return Promise.resolve(true);
  };

  const setPaneClickDistance = (distance: number) => {
    store.panZoom?.setClickDistance(distance);
  };

  const unselectNodesAndEdges = ({
    nodes: _nodes,
    edges,
  }: Partial<NodeGraph<NodeType, EdgeType>> = {}) => {
    const nodesToUnselect = new Set((_nodes ? _nodes : store.nodes).map(({ id }) => id));

    if (nodesToUnselect.size) {
      setNodesStore((nodes) => {
        for (const node of nodes) {
          if (nodesToUnselect.has(node.id)) node.selected = false;
        }
        return undefined;
      });
    }

    const edgesToUnselect = new Set((edges ?? store.edges).map(({ id }) => id));

    if (edgesToUnselect.size) {
      setEdgesStore((edges) => {
        for (const edge of edges) {
          if (edgesToUnselect.has(edge.id)) edge.selected = false;
        }
        return undefined;
      });
    }

    // Gesture boundary: XYDrag reads selection through nodeLookup right after
    // calling this, so the internalNodes projection must re-derive now.
    flush();
  };

  const stableSetViewport = (viewport: Viewport) => setViewportStore(() => viewport);

  const addSelectedNodes = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;
    const idSet = new Set(ids);

    setNodesStore((nodes) => {
      for (const node of nodes) {
        const nodeWillBeSelected = idSet.has(node.id);
        const selected = isMultiSelection
          ? node.selected || nodeWillBeSelected
          : nodeWillBeSelected;

        if (node.selected !== selected) node.selected = selected;
      }
      return undefined;
    });

    if (!isMultiSelection) {
      unselectNodesAndEdges({ nodes: [] });
    }

    // Gesture boundary: the drag handler reads the selected state through
    // nodeLookup synchronously after selection (selectNodesOnDrag).
    flush();
  };

  const addSelectedEdges = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;

    setEdgesStore((edges) => {
      for (const edge of edges) {
        const edgeWillBeSelected = ids.includes(edge.id);
        const selected = isMultiSelection
          ? edge.selected || edgeWillBeSelected
          : edgeWillBeSelected;

        if (edge.selected !== selected) edge.selected = selected;
      }
      return undefined;
    });

    if (!isMultiSelection) {
      unselectNodesAndEdges({ edges: [] });
    }

    flush();
  };

  const handleNodeSelection = (id: string, unselect?: boolean, nodeRef?: HTMLDivElement | null) => {
    const node = store.nodes.find((n) => n.id === id);

    if (!node) {
      console.warn("012", errorMessages["error012"](id));
      return;
    }

    setSelectionRect(undefined);
    setSelectionRectMode(undefined);

    if (!node.selected) {
      addSelectedNodes([id]);
    } else if (unselect || (node.selected && store.multiselectionKeyPressed)) {
      unselectNodesAndEdges({ nodes: [node], edges: [] });

      requestAnimationFrame(() => nodeRef?.blur());
    }
  };

  const handleEdgeSelection = (id: string) => {
    const edge = edgeLookup[id];

    if (!edge) {
      console.warn("012", errorMessages["error012"](id));
      return;
    }

    if (!isEdgeSelectable(edge, store)) return;

    setSelectionRect(undefined);
    setSelectionRectMode(undefined);

    if (!edge.selected) {
      addSelectedEdges([id]);
    } else if (edge.selected && store.multiselectionKeyPressed) {
      unselectNodesAndEdges({ nodes: [], edges: [edge] });
    }
  };

  const moveSelectedNodes = (direction: XYPosition, factor: number) => {
    const nodeUpdates = new Map<string, Pick<NodeDragItem, "position">>();
    /*
     * by default a node moves 5px on each key press
     * if snap grid is enabled, we use that for the velocity
     */
    const xVelo = store.snapGrid?.[0] ?? 5;
    const yVelo = store.snapGrid?.[1] ?? 5;

    const xDiff = direction.x * xVelo * factor;
    const yDiff = direction.y * yVelo * factor;

    for (const node of nodeLookup.values()) {
      const isSelected =
        node.selected &&
        (node.draggable || (store.nodesDraggable && typeof node.draggable === "undefined"));

      if (!isSelected) {
        continue;
      }

      let nextPosition = {
        x: node.internals.positionAbsolute.x + xDiff,
        y: node.internals.positionAbsolute.y + yDiff,
      };

      if (store.snapGrid) {
        nextPosition = snapPosition(nextPosition, store.snapGrid);
      }

      const { position } = calculateNodePosition({
        nodeId: node.id,
        nextPosition,
        nodeLookup,
        nodeExtent: store.nodeExtent,
        nodeOrigin: store.nodeOrigin,
        onError: store.onError,
      });

      // The user-graph write is the whole move: absolute positions re-derive
      // in the internalNodes projection.
      nodeUpdates.set(node.id, { position });
    }

    updateNodePositions(nodeUpdates);
  };

  const panBy = (delta: XYPosition) => {
    return panBySystem({
      delta,
      panZoom: store.panZoom,
      transform: store.transform,
      translateExtent: store.translateExtent,
      width: store.width,
      height: store.height,
    });
  };

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

  const updateNode: FlowCommands<NodeType, EdgeType>["updateNode"] = (
    id,
    nodeUpdate,
    options = { replace: false },
  ) => {
    setNodesStore((nodes) => {
      const index = nodes.findIndex((node) => node.id === id);
      if (index === -1) return undefined;

      const node = nodes[index]!;
      const nextNode = typeof nodeUpdate === "function" ? nodeUpdate(node) : nodeUpdate;
      nodes[index] =
        options?.replace && isNode<NodeType>(nextNode) ? nextNode : { ...node, ...nextNode };
      return undefined;
    });
  };

  const commands: FlowCommands<NodeType, EdgeType> = {
    fitView,
    fitBounds: async (bounds, options) => {
      if (!store.panZoom) return false;

      const viewport = getViewportForBounds(
        bounds,
        store.width,
        store.height,
        store.minZoom,
        store.maxZoom,
        options?.padding ?? 0.1,
      );

      await store.panZoom.setViewport(viewport, {
        duration: options?.duration,
        ease: options?.ease,
        interpolate: options?.interpolate,
      });

      return true;
    },
    zoomIn,
    zoomOut,
    setZoom: (zoomLevel, options) => {
      const currentPanZoom = store.panZoom;
      return currentPanZoom
        ? currentPanZoom.scaleTo(zoomLevel, { duration: options?.duration })
        : Promise.resolve(false);
    },
    setCenter,
    setViewport: async (nextViewport, options) => {
      const currentViewport = store.viewport;

      if (!store.panZoom) return false;

      await store.panZoom.setViewport(
        {
          x: nextViewport.x ?? currentViewport.x,
          y: nextViewport.y ?? currentViewport.y,
          zoom: nextViewport.zoom ?? currentViewport.zoom,
        },
        options,
      );

      return true;
    },
    panBy,
    screenToFlowPosition: (position, options = { snapToGrid: true }) => {
      if (!store.domNode) return position;

      const _snapGrid = options.snapToGrid ? store.snapGrid : false;
      const { x, y, zoom } = store.viewport;
      const { x: domX, y: domY } = store.domNode.getBoundingClientRect();
      const correctedPosition = {
        x: position.x - domX,
        y: position.y - domY,
      };

      return pointToRendererPoint(
        correctedPosition,
        [x, y, zoom],
        !!_snapGrid,
        _snapGrid || [1, 1],
      );
    },
    flowToScreenPosition: (position) => {
      if (!store.domNode) return position;

      const { x, y, zoom } = store.viewport;
      const { x: domX, y: domY } = store.domNode.getBoundingClientRect();
      const rendererPosition = rendererPointToPoint(position, [x, y, zoom]);

      return {
        x: rendererPosition.x + domX,
        y: rendererPosition.y + domY,
      };
    },
    addNodes: (payload) => {
      const newNodes = Array.isArray(payload) ? payload : [payload];
      setNodesStore((nodes) => [...nodes, ...newNodes]);
    },
    addEdges: (payload) => {
      const newEdges = Array.isArray(payload) ? payload : [payload];
      setEdgesStore((edges) => [...edges, ...newEdges]);
    },
    setNodes: setNodesStore,
    setEdges: setEdgesStore,
    updateNode,
    updateNodeData: (id, dataUpdate, options) => {
      const node = nodeLookup.get(id)?.internals.userNode;
      if (!node) return;

      const nextData = typeof dataUpdate === "function" ? dataUpdate(node) : dataUpdate;
      updateNode(id, (current) => ({
        ...current,
        data: options?.replace ? nextData : { ...current.data, ...nextData },
      }));
    },
    updateEdge: (id, edgeUpdate, options = { replace: false }) => {
      setEdgesStore((edges) => {
        const index = edges.findIndex((edge) => edge.id === id);
        if (index === -1) return undefined;

        const edge = edges[index]!;
        const nextEdge = typeof edgeUpdate === "function" ? edgeUpdate(edge) : edgeUpdate;
        edges[index] =
          options.replace && isEdge<EdgeType>(nextEdge) ? nextEdge : { ...edge, ...nextEdge };
        return undefined;
      });
    },
    deleteElements: async ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
      const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove<
        NodeType,
        EdgeType
      >({
        nodesToRemove,
        edgesToRemove,
        nodes: store.nodes,
        edges: store.edges,
        onBeforeDelete: store.onBeforeDelete,
      });

      if (matchingEdges) {
        const remainingEdges = store.edges.filter(
          (edge) => !matchingEdges.some(({ id }) => id === edge.id),
        );

        store.onEdgesDelete?.(matchingEdges);
        setEdgesStore(() => remainingEdges);
      }

      if (matchingNodes) {
        const remainingNodes = store.nodes.filter(
          (node) => !matchingNodes.some(({ id }) => id === node.id),
        );

        store.onNodesDelete?.(matchingNodes);
        setNodesStore(() => remainingNodes);
      }

      // Every delete path (keyboard AND programmatic) notifies here, so
      // commands.deleteElements never deletes silently.
      const deletedNodes = matchingNodes ?? [];
      const deletedEdges = matchingEdges ?? [];
      if (deletedNodes.length > 0 || deletedEdges.length > 0) {
        store.onDelete?.({ nodes: deletedNodes, edges: deletedEdges });
      }

      return {
        deletedNodes: matchingNodes,
        deletedEdges: matchingEdges,
      };
    },
    getIntersectingNodes: (nodeOrRect, partially = true, nodesToIntersect) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) return [];

      return (nodesToIntersect || store.nodes).filter((n) => {
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
    toObject: () => {
      return structuredClone({
        nodes: [...snapshot(store.nodes)],
        edges: [...snapshot(store.edges)],
        viewport: { ...snapshot(store.viewport) },
      });
    },
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

  // Garbage-collect measurements for nodes that no longer exist in the user
  // graph. Entries only appear via the measurement ingest, keyed by node id,
  // so tracking the node ids is sufficient.
  createEffect(
    () => new Set(store.nodes.map((n) => n.id)),
    (currentIds) => {
      setMeasurementsStore((draft) => {
        for (const id of Object.keys(draft)) {
          if (!currentIds.has(id)) {
            // `delete` is required: unlike the 1.x path setter, assigning
            // undefined in a 2.0 draft KEEPS the own key — visible to `in`
            // guards and Object.keys, and skips structural notification
            // (spike 09).
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
            delete draft[id];
          }
        }
        return undefined;
      });
    },
  );

  // TODO: Add viewportInitialized to store
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
      getEdge,
      applyInitialFitView,
      applyMeasurementWrites,
      applyNodeChanges,
      markInitialNodesMeasured,
      setMeasureRequester,
      resetStoreValues,
      setAriaLabelConfig,
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

      // Port Svelte Flow Actions to Solid Flow
      addEdge,
      updateNodePositions,
      zoomIn,
      zoomOut,
      fitView,
      setCenter,

      setPaneClickDistance,
      unselectNodesAndEdges,
      addSelectedNodes,
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
