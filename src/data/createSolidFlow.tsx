import { createMediaQuery } from "@solid-primitives/media";
import {
  addEdge as systemAddEdge,
  calculateNodePosition,
  type Connection,
  type ConnectionState,
  errorMessages,
  fitViewport,
  getInternalNodesBounds,
  getViewportForBounds,
  type Handle,
  infiniteExtent,
  initialConnection,
  mergeAriaLabelConfig,
  type NodeDragItem,
  type NodeLookup,
  panBy as panBySystem,
  type PanZoomInstance,
  pointToRendererPoint,
  type SelectionRect,
  type SetCenterOptions,
  snapPosition,
  type Transform,
  type Viewport,
  type ViewportHelperFunctionOptions,
  type XYPosition,
} from "@xyflow/system";
import {
  createEffect,
  createMemo,
  createSignal,
  createStore,
  flush,
  merge,
  untrack,
} from "solid-js";

import {
  BezierEdgeInternal,
  SmoothStepEdgeInternal,
  StepEdgeInternal,
  StraightEdgeInternal,
} from "~/components/graph/edge";
import { DefaultNode, GroupNode, InputNode, OutputNode } from "~/components/graph/node";
import type { SolidFlowProps } from "~/components/SolidFlow/types";
import {
  createConnections,
  createEdgeLookup,
  createInternalNodes,
  createLayoutedEdges,
  createParentIds,
  type NodeMeasurements,
  RecordMapFacade,
} from "~/core";
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
} from "~/types";
import { scheduleIdleCallback } from "~/utils";

import { getDefaultFlowStateProps } from "./defaults";
import type { InternalUpdateEntry } from "./types";
import { handleExpandParent, measureNodeInternals } from "./xyflow";

export const InitialNodeTypesMap = {
  input: InputNode,
  output: OutputNode,
  default: DefaultNode,
  group: GroupNode,
} satisfies BuiltInNodeTypes;

export const InitialEdgeTypesMap = {
  straight: StraightEdgeInternal,
  smoothstep: SmoothStepEdgeInternal,
  default: BezierEdgeInternal,
  step: StepEdgeInternal,
} satisfies BuiltInEdgeTypes;

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

export const createSolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: SolidFlowProps<NodeType, EdgeType>,
) => {
  const _props = merge(getDefaultFlowStateProps<NodeType, EdgeType>(), props);

  const mediaPrefersDark = createMediaQuery(
    "(prefers-color-scheme: dark)",
    // NOTE:  should mediaPrefersDark be reactive to config-changes?
    _props.colorModeSSR === "dark",
  );

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
  const [nodesConnectable, setNodesConnectable] = createSignal(() => config().nodesDraggable);
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

  // Plain writable stores seeded from the user's graph, reset by the effects
  // below when the supplied array identity changes (matching 1.x, where the
  // backing store was recreated whenever the accessor value changed); all
  // other writes are local drafts. NOT the projection form of createStore:
  // deriving from a store-proxy source rewraps every element on structural
  // writes, so a single addEdge/addNode would churn all row identities and
  // recreate the whole mapArray pipeline (verified empirically on rc.1).
  const [nodesStore, setNodesStore] = createStore<NodeType[]>(_props.nodes as NodeType[]);
  const [edgesStore, setEdgesStore] = createStore<EdgeType[]>(_props.edges as EdgeType[]);

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

  createEffect(
    () => config().nodes as NodeType[],
    (next) => {
      setNodesStore(() => next);
    },
    { defer: true },
  );
  createEffect(
    () => config().edges as EdgeType[],
    (next) => {
      setEdgesStore(() => next);
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
      return this._colorMode === "system"
        ? mediaPrefersDark()
          ? "dark"
          : "light"
        : this._colorMode;
    },
    get connection() {
      const state = connection();
      return {
        ...state,
        to: state.inProgress ? pointToRendererPoint(state.to, this.transform) : state.to,
      } as ConnectionState<InternalNode<NodeType>>;
    },
    get domNode() {
      return domNode();
    },
    get dragging() {
      return dragging();
    },
    get edgeTypes() {
      return { ...InitialEdgeTypesMap, ...this._edgeTypes } as EdgeTypes;
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
      return { ...InitialNodeTypesMap, ...this._nodeTypes } as NodeTypes;
    },
    get panZoom() {
      return panZoom();
    },
    get selectedNodes() {
      return nodesStore.filter((node) => node.selected);
    },
    get selectedEdges() {
      return edgesStore.filter((edge) => edge.selected);
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
    get visibleNodesMap() {
      return visibleNodesMap();
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

  const visibleNodesMap = createMemo<Map<string, InternalNode>>(() => {
    // TODO: Refine onlyRenderVisibleElements implementation
    // if (store.onlyRenderVisibleElements) {
    //   return getVisibleNodes(nodeLookup, transform(), store.width ?? 0, store.height ?? 0);
    // }
    return nodeLookup;
  });

  const visibleNodeIds = createMemo(() => {
    return Array.from(visibleNodesMap().values()).map((edge) => edge.id);
  });

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
    get onlyRenderVisibleElements() {
      return store.onlyRenderVisibleElements;
    },
    get width() {
      return store.width;
    },
    get height() {
      return store.height;
    },
    get transform() {
      return store.transform;
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

  let pendingEntries: InternalUpdateEntry[] | undefined = undefined;

  const requestUpdateNodeInternals = (updateEntries: InternalUpdateEntry[]) => {
    if (pendingEntries) {
      pendingEntries.push(...updateEntries);
      return;
    }

    pendingEntries = updateEntries;

    scheduleIdleCallback(() => {
      const updates = new Map(pendingEntries);
      pendingEntries = undefined;

      // DOM measurement pass: reads element geometry against the current
      // internal nodes and reports it as data — no lookup writes.
      const { updatedInternals, measurementWrites, changes, parentExpandChildren } =
        measureNodeInternals(updates, nodeLookup, store.domNode);

      if (!updatedInternals) return;

      setMeasurementsStore((draft) => {
        for (const write of measurementWrites) {
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
      // Re-derive internalNodes now so parent expansion sees this pass's geometry.
      flush();

      if (parentExpandChildren.length > 0) {
        changes.push(
          ...handleExpandParent(
            parentExpandChildren,
            nodeLookup,
            (parentId) => nodesStore.filter((node) => node.parentId === parentId),
            store.nodeOrigin,
          ),
        );
      }

      if (changes.length > 0) {
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
      }

      flush();
      initialNodesMeasured = true;
      tryInitialFitView();
    });
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

  const addSelectedNodes = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;

    setNodesStore((nodes) => {
      for (const node of nodes) {
        const nodeWillBeSelected = ids.includes(node.id);
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

    const selectable =
      edge.selectable || (store.elementsSelectable && typeof edge.selectable === "undefined");

    if (!selectable) return;

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
    internalNodes,
    nodeLookup,
    edgeLookup,
    parentIds,
    connections,
    actions: {
      getEdge,
      applyInitialFitView,
      resetStoreValues,
      requestUpdateNodeInternals,
      setAriaLabelConfig,
      setAriaLiveMessage,
      setClickConnectStartHandle,
      setConfig,
      setConnection,
      setDeleteKeyPressed,
      setDomNode,
      setDragging,
      get setEdges() {
        return setEdgesStore;
      },
      setElementsSelectable,
      setHeight,
      setMultiselectionKeyPressed,
      get setNodes() {
        return setNodesStore;
      },
      setNodesConnectable,
      setNodesDraggable,
      setPanActivationKeyPressed,
      setPanZoom,
      setSelectionKeyPressed,
      setSelectionRect,
      setSelectionRectMode,
      get setViewport() {
        return (viewport: Viewport) => setViewportStore(() => viewport);
      },
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
