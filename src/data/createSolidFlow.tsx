import { ReactiveMap } from "@solid-primitives/map";
import { createMediaQuery } from "@solid-primitives/media";
import {
  addEdge as systemAddEdge,
  calculateNodePosition,
  clampPosition,
  type Connection,
  ConnectionMode,
  type ConnectionState,
  errorMessages,
  fitViewport,
  getEdgePosition,
  getElevatedEdgeZIndex,
  getInternalNodesBounds,
  getNodeDimensions,
  getNodePositionWithOrigin,
  getViewportForBounds,
  type Handle,
  type HandleConnection,
  infiniteExtent,
  initialConnection,
  type InternalNodeBase,
  isCoordinateExtent,
  isEdgeVisible,
  mergeAriaLabelConfig,
  type NodeDimensionChange,
  type NodeDragItem,
  type NodeLookup,
  type NodePositionChange,
  panBy as panBySystem,
  type PanZoomInstance,
  pointToRendererPoint,
  type SelectionRect,
  type SetCenterOptions,
  snapPosition,
  type Transform,
  updateAbsolutePositions,
  updateNodeInternals as systemUpdateNodeInternals,
  type Viewport,
  type ViewportHelperFunctionOptions,
  type XYPosition,
} from "@xyflow/system";
import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  createStore,
  flush,
  mapArray,
  merge,
  onCleanup,
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
import type {
  BuiltInEdgeTypes,
  BuiltInNodeTypes,
  Edge,
  EdgeLayouted,
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
import {
  addConnectionToLookup,
  adoptUserNodes,
  calculateZ,
  removeConnectionFromLookup,
  updateChildNode,
} from "./xyflow";

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
  // This is just used to make sure adoptUserNodes is called before we calculate the viewport
  _nodesInitialized: boolean,
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

  const nodeLookup = new ReactiveMap<string, InternalNode<NodeType>>();
  const parentLookup = new ReactiveMap<string, Map<string, InternalNode<NodeType>>>();
  const edgeLookup = new ReactiveMap<string, EdgeType>();
  const connectionLookup = new ReactiveMap<string, Map<string, HandleConnection>>();
  const layoutedEdgesMap = new ReactiveMap<string, EdgeLayouted<EdgeType>>();

  const startNodesInitialized = untrack(() => {
    return adoptUserNodes(_props.nodes as NodeType[], nodeLookup, parentLookup, {
      nodeExtent: _props.nodeExtent,

      nodeOrigin: _props.nodeOrigin,

      elevateNodesOnSelect: _props.elevateNodesOnSelect,

      zIndexMode: _props.zIndexMode,
      checkEquality: true,
    });
  });

  const initialViewport = getInitialViewport(
    startNodesInitialized,

    _props.fitView,
    _props.initialViewport,

    _props.width ?? 0,

    _props.height ?? 0,
    nodeLookup,
  );

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

  const visibleEdgeIds = createMemo(() => {
    return Array.from(layoutedEdgesMap.values()).map((edge) => edge.id);
  });

  const getEdge = (id: string) => layoutedEdgesMap.get(id);

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
    nodeDragItems: Map<string, NodeDragItem | InternalNodeBase<NodeType>>,
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
      {
        const updates = new Map(pendingEntries);
        pendingEntries = undefined;
        const { changes, updatedInternals } = systemUpdateNodeInternals(
          updates,
          nodeLookup,
          parentLookup,
          store.domNode,
          store.nodeOrigin,
        );

        if (!updatedInternals) return;

        updateAbsolutePositions(nodeLookup, parentLookup, {
          nodeOrigin: store.nodeOrigin,
          nodeExtent: store.nodeExtent,
          zIndexMode: store.zIndexMode,
        });

        const nodeToChange = changes.reduce<Map<string, NodeDimensionChange | NodePositionChange>>(
          (acc, change) => {
            const node = nodeLookup.get(change.id)?.internals.userNode;

            if (!node) return acc;

            acc.set(node.id, change);

            return acc;
          },
          new Map(),
        );

        setNodesStore((nodes) => {
          for (const node of nodes) {
            const change = nodeToChange.get(node.id);
            if (!change) continue;

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

        flush();
        initialNodesMeasured = true;
        tryInitialFitView();
      }
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
  };

  const addSelectedNodes = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;
    const selectState = new Map<string, boolean>();

    setNodesStore((nodes) => {
      for (const node of nodes) {
        const nodeWillBeSelected = ids.includes(node.id);
        const selected = isMultiSelection
          ? node.selected || nodeWillBeSelected
          : nodeWillBeSelected;

        selectState.set(node.id, selected);
        if (node.selected === selected) continue;

        // we need to mutate the internal node here in order to have the correct selected state in the drag handler
        const internalNode = nodeLookup.get(node.id);
        if (internalNode) internalNode.selected = selected;
        node.selected = selected;
      }
      return undefined;
    });

    if (!isMultiSelection) {
      unselectNodesAndEdges({ nodes: [] });
    }
  };

  const addSelectedEdges = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;
    const edgeSelectState = new Map<string, boolean>();

    setEdgesStore((edges) => {
      for (const edge of edges) {
        const edgeWillBeSelected = ids.includes(edge.id);
        const selected = isMultiSelection
          ? edge.selected || edgeWillBeSelected
          : edgeWillBeSelected;

        edgeSelectState.set(edge.id, selected);
        if (edge.selected !== selected) edge.selected = selected;
      }
      return undefined;
    });

    if (!isMultiSelection) {
      unselectNodesAndEdges({ edges: [] });
    }
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
    const edge = edgeLookup.get(id);

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
    const nodeUpdates = new Map<string, InternalNode<NodeType>>();
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

      const { position, positionAbsolute } = calculateNodePosition({
        nodeId: node.id,
        nextPosition,
        nodeLookup,
        nodeExtent: store.nodeExtent,
        nodeOrigin: store.nodeOrigin,
        onError: store.onError,
      });

      node.position = position;
      node.internals.positionAbsolute = positionAbsolute;

      nodeUpdates.set(node.id, node);
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

  createEffect(
    () => {
      if (width() && height() && panZoom()) tryInitialFitView();
    },
    () => {},
  );

  createEffect(
    () => {
      store.panZoom?.syncViewport(store.viewport);
    },
    () => {},
  );

  createEffect(
    () => {
      const _panZoom = panZoom();
      if (!_panZoom) return;

      createEffect(
        () => [store.minZoom, store.maxZoom] as [number, number],
        (extent) => {
          _panZoom.setScaleExtent(extent);
        },
      );

      createEffect(
        () => store.translateExtent,
        (extent) => {
          _panZoom.setTranslateExtent(extent);
        },
      );
    },
    () => {},
  );

  createRenderEffect(
    mapArray(
      () => store.nodes as unknown as NodeType[],
      (userNode) => {
        createRenderEffect(
          () => {
            const internalNode = untrack(() => nodeLookup.get(userNode.id));
            const selectedNodeZ: number =
              store.elevateNodesOnSelect && store.zIndexMode !== "manual" ? 1000 : 0;

            const clampedPosition = clampPosition(
              getNodePositionWithOrigin(userNode, store.nodeOrigin),
              isCoordinateExtent(userNode.extent) ? userNode.extent : store.nodeExtent,
              getNodeDimensions(userNode),
            );

            /*
             * We preserve the measured dimensions of the node if the user has provided them.
             * If the user has not provided them, we use the previously measured dimensions.
             * If the user has not provided them and there are no previously measured dimensions,
             * we reset the handleBounds so that the node gets re-measured.
             */
            const preservedMeasured = {
              width: userNode.measured?.width ?? internalNode?.measured?.width,
              height: userNode.measured?.height ?? internalNode?.measured?.height,
            };

            const updatedNodeInternals = {
              ...userNode,
              measured: preservedMeasured,
              internals: {
                positionAbsolute: clampedPosition,
                // If there is neither a user-provided nor a previously measured size,
                // reset handleBounds so that the node gets re-measured.
                handleBounds:
                  !userNode.measured && !internalNode?.measured
                    ? undefined
                    : internalNode?.internals.handleBounds,
                z: calculateZ(userNode, selectedNodeZ, store.zIndexMode),
                userNode,
              },
            } as InternalNode<NodeType>;

            nodeLookup.set(userNode.id, updatedNodeInternals);

            if (userNode.parentId) {
              updateChildNode(updatedNodeInternals, nodeLookup, parentLookup, {
                nodeOrigin: store.nodeOrigin,
                nodeExtent: store.nodeExtent,
                elevateNodesOnSelect: store.elevateNodesOnSelect,
                zIndexMode: store.zIndexMode,
                checkEquality: true,
              });
            }
          },
          () => {},
        );

        // Do not delete here; we garbage-collect removed nodes in a separate effect
        onCleanup(() => {
          /* noop */
        });
      },
    ),
    () => {},
  );

  // Garbage-collect nodeLookup entries for nodes that no longer exist in the store
  createEffect(
    () => {
      const currentIds = new Set(store.nodes.map((n) => n.id));
      for (const id of Array.from(nodeLookup.keys())) {
        if (!currentIds.has(id)) {
          nodeLookup.delete(id);
        }
      }
    },
    () => {},
  );

  createRenderEffect(
    mapArray(
      () => store.edges,
      (edge) => {
        const {
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle = null,
          targetHandle = null,
        } = edge;

        const connection = {
          edgeId: edge.id,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle,
          targetHandle,
        };

        const sourceKey = `${sourceNodeId}-${sourceHandle}--${targetNodeId}-${targetHandle}`;
        const targetKey = `${targetNodeId}-${targetHandle}--${sourceNodeId}-${sourceHandle}`;

        createRenderEffect(
          () => {
            {
              addConnectionToLookup(
                "source",
                connection,
                targetKey,
                connectionLookup,
                sourceNodeId,
                sourceHandle,
              );

              addConnectionToLookup(
                "target",
                connection,
                sourceKey,
                connectionLookup,
                targetNodeId,
                targetHandle,
              );

              edgeLookup.set(edge.id, edge);
            }
          },
          () => {},
        );

        createRenderEffect(
          () => {
            const sourceNode = nodeLookup.get(edge.source);
            const targetNode = nodeLookup.get(edge.target);

            if (!sourceNode || !targetNode) return;

            if (store.onlyRenderVisibleElements) {
              const edgeVisible = isEdgeVisible({
                sourceNode,
                targetNode,
                width: store.width ?? 0,
                height: store.height ?? 0,
                transform: store.transform,
              });

              if (!edgeVisible) return;

              store.visibleNodesMap.set(sourceNode.id, sourceNode);
              store.visibleNodesMap.set(targetNode.id, targetNode);
            }

            const edgePosition = getEdgePosition({
              id: edge.id,
              sourceNode,
              targetNode,
              sourceHandle: edge.sourceHandle || null,
              targetHandle: edge.targetHandle || null,
              connectionMode: store.connectionMode as ConnectionMode,
              onError: store.onError,
            });

            if (!edgePosition) return;

            layoutedEdgesMap.set(edge.id, {
              ...store.defaultEdgeOptions,
              ...edge,
              ...edgePosition,
              zIndex: getElevatedEdgeZIndex({
                selected: edge.selected,
                zIndex: edge.zIndex ?? store.defaultEdgeOptions.zIndex,
                sourceNode,
                targetNode,
                elevateOnSelect: store.elevateEdgesOnSelect,
                zIndexMode: store.zIndexMode,
              }),
              sourceNode,
              targetNode,
              edge,
            });
          },
          () => {},
        );

        onCleanup(() => {
          {
            edgeLookup.delete(edge.id);
            layoutedEdgesMap.delete(edge.id);

            removeConnectionFromLookup(
              "source",
              targetKey,
              connectionLookup,
              sourceNodeId,
              sourceHandle,
            );

            removeConnectionFromLookup(
              "target",
              sourceKey,
              connectionLookup,
              targetNodeId,
              targetHandle,
            );
          }
        });
      },
    ),
    () => {},
  );

  createEffect(
    () => {
      const currentIds = new Set(store.edges.map((e) => e.id));
      for (const id of Array.from(edgeLookup.keys())) {
        if (!currentIds.has(id)) {
          edgeLookup.delete(id);
          connectionLookup.delete(id);
          layoutedEdgesMap.delete(id);
        }
      }
    },
    () => {},
  );

  // TODO: Add viewportInitialized to store
  return {
    store,
    nodeLookup,
    edgeLookup,
    parentLookup,
    connectionLookup,
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
