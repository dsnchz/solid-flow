import { ReactiveMap } from "@solid-primitives/map";
import { createMediaQuery } from "@solid-primitives/media";
import {
  addEdge as systemAddEdge,
  adoptUserNodes,
  calculateNodePosition,
  type Connection,
  type ConnectionLookup,
  ConnectionMode,
  type ConnectionState,
  createMarkerIds,
  type EdgeLookup,
  errorMessages,
  fitViewport,
  getInternalNodesBounds,
  getViewportForBounds,
  type Handle,
  infiniteExtent,
  initialConnection,
  type InternalNodeBase,
  type MarkerProps,
  mergeAriaLabelConfig,
  type NodeDimensionChange,
  type NodeDragItem,
  type NodeLookup,
  type NodePositionChange,
  panBy as panBySystem,
  type PanZoomInstance,
  type ParentLookup,
  pointToRendererPoint,
  type SelectionRect,
  type SetCenterOptions,
  snapPosition,
  type Transform,
  updateAbsolutePositions,
  updateConnectionLookup,
  updateNodeInternals as systemUpdateNodeInternals,
  type Viewport,
  type ViewportHelperFunctionOptions,
  type XYPosition,
} from "@xyflow/system";
import { batch, createEffect, createMemo, createSignal, mergeProps, on } from "solid-js";
import { produce } from "solid-js/store";

import {
  BezierEdgeInternal,
  SmoothStepEdgeInternal,
  StepEdgeInternal,
  StraightEdgeInternal,
} from "@/components/graph/edge";
import { DefaultNode, GroupNode, InputNode, OutputNode } from "@/components/graph/node";
import type { SolidFlowProps } from "@/components/SolidFlow/types";
import type { FitViewOptions } from "@/shared/types";
import type {
  BuiltInEdgeTypes,
  BuiltInNodeTypes,
  Edge,
  EdgeLayouted,
  EdgeTypes,
  InternalNode,
  Node,
  NodeGraph,
  NodeTypes,
} from "@/types";
import { createWritable, createWritableStore, deepTrack } from "@/utils";

import { getDefaultFlowStateProps } from "./defaults";
import type { InternalUpdateEntry } from "./types";
import { type EdgeLayoutAllOptions, getLayoutedEdges, getVisibleNodes } from "./visibleElements";

type RefinedMarkerProps = Omit<MarkerProps, "markerUnits"> & {
  readonly markerUnits?: "strokeWidth" | "userSpaceOnUse" | undefined;
};

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
  props: Partial<SolidFlowProps<NodeType, EdgeType>>,
) => {
  const _props = mergeProps(getDefaultFlowStateProps<NodeType, EdgeType>(), props);

  const nodeLookup: NodeLookup<InternalNode<NodeType>> = new ReactiveMap();
  const parentLookup: ParentLookup<InternalNode<NodeType>> = new ReactiveMap();
  const edgeLookup: EdgeLookup<EdgeType> = new ReactiveMap();
  const connectionLookup: ConnectionLookup = new ReactiveMap();

  // eslint-disable-next-line solid/reactivity
  batch(() => updateConnectionLookup(connectionLookup, edgeLookup, _props.edges));

  const startNodesInitialized = batch(() => {
    // eslint-disable-next-line solid/reactivity
    return adoptUserNodes(_props.nodes, nodeLookup, parentLookup, {
      // eslint-disable-next-line solid/reactivity
      nodeExtent: _props.nodeExtent,
      // eslint-disable-next-line solid/reactivity
      nodeOrigin: _props.nodeOrigin,
      // eslint-disable-next-line solid/reactivity
      elevateNodesOnSelect: _props.elevateNodesOnSelect,
      checkEquality: true,
    });
  });

  const initialViewport = getInitialViewport(
    startNodesInitialized,
    // eslint-disable-next-line solid/reactivity
    _props.fitView,
    _props.initialViewport,
    // eslint-disable-next-line solid/reactivity
    _props.width ?? 0,
    // eslint-disable-next-line solid/reactivity
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

  const [ariaLabelConfig, setAriaLabelConfig] = createWritable(() =>
    mergeAriaLabelConfig(config().ariaLabelConfig),
  );
  const [ariaLiveMessage, setAriaLiveMessage] = createWritable(() => config().ariaLiveMessage);
  const [clickConnectStartHandle, setClickConnectStartHandle] = createSignal<
    Pick<Handle, "id" | "nodeId" | "type"> | undefined
  >(undefined);
  const [connection, setConnection] =
    createSignal<ConnectionState<InternalNode<NodeType>>>(initialConnection);
  const [domNode, setDomNode] = createSignal<HTMLDivElement | null>(null);
  const [dragging, setDragging] = createSignal(false);
  const [elementsSelectable, setElementsSelectable] = createWritable(
    () => config().elementsSelectable,
  );
  const [fitViewPromise, setFitViewPromise] = createSignal<Promise<boolean> | undefined>();
  const [fitViewOptions, setFitViewOptions] = createWritable(() => config().fitViewOptions);
  const [height, setHeight] = createWritable(() => config().height);
  const [minZoom, _setMinZoom] = createWritable<number>(() => config().minZoom);
  const [maxZoom, _setMaxZoom] = createWritable<number>(() => config().maxZoom);
  const [nodesConnectable, setNodesConnectable] = createWritable(() => config().nodesDraggable);
  const [nodesDraggable, setNodesDraggable] = createWritable(() => config().nodesDraggable);
  const [panZoom, setPanZoom] = createSignal<PanZoomInstance | null>(null);
  const [selectionRect, setSelectionRect] = createSignal<SelectionRect | undefined>();
  const [selectionRectMode, setSelectionRectMode] = createSignal<string | undefined>();
  const [snapGrid, setSnapGrid] = createWritable(() => config().snapGrid);
  const [translateExtent, _setTranslateExtent] = createWritable(
    () => config().translateExtent ?? infiniteExtent,
  );
  const [viewport, setViewport] = createSignal<Viewport>(initialViewport);
  const [width, setWidth] = createWritable(() => config().width);

  // Key flags
  const [selectionKeyPressed, setSelectionKeyPressed] = createSignal(false);
  const [multiselectionKeyPressed, setMultiselectionKeyPressed] = createSignal(false);
  const [deleteKeyPressed, setDeleteKeyPressed] = createSignal(false);
  const [panActivationKeyPressed, setPanActivationKeyPressed] = createSignal(false);
  const [zoomActivationKeyPressed, setZoomActivationKeyPressed] = createSignal(false);

  const transform = createMemo(() => [viewport().x, viewport().y, viewport().zoom] as Transform);

  const nodesMemo = createWritableStore(() => config().nodes);
  const edgesMemo = createWritableStore(() => config().edges);

  /**********************************************************************************/
  /*                                                                                */
  /*                                  Declare Store                                 */
  /*                                                                                */
  /**********************************************************************************/

  // eslint-disable-next-line solid/reactivity
  const store = mergeProps({ width: 0, height: 0 }, config, {
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
    get fitViewPromise() {
      return fitViewPromise();
    },
    get fitViewOptions() {
      return fitViewOptions();
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
    get markers() {
      return createMarkerIds(config().edges, {
        defaultColor: config().defaultMarkerColor,
        id: config().id,
      }) as RefinedMarkerProps[];
    },
    get maxZoom() {
      return maxZoom();
    },
    get minZoom() {
      return minZoom();
    },
    get nodes() {
      return nodesMemo.get();
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
      return config().nodes.filter((node) => node.selected);
    },
    get selectedEdges() {
      return config().edges.filter((edge) => edge.selected);
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
      return viewport();
    },
    get viewportInitialized() {
      return panZoom() !== null;
    },
    get visibleEdgeIds() {
      return visibleEdgeIds();
    },
    get visibleEdgesMap() {
      return visibleEdgesMap();
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
    if (store.onlyRenderVisibleElements) {
      return getVisibleNodes(nodeLookup, transform(), store.width ?? 0, store.height ?? 0);
    }
    return nodeLookup;
  });

  const visibleNodeIds = createMemo(() => {
    return Array.from(visibleNodesMap().values()).map((edge) => edge.id);
  });

  const visibleEdgesMap = createMemo<Map<string, EdgeLayouted<EdgeType>>>((previousEdges) => {
    const options = {
      edges: store.edges,
      defaultEdgeOptions: store.defaultEdgeOptions,
      previousEdges,
      nodeLookup,
      connectionMode: store.connectionMode as ConnectionMode,
      elevateEdgesOnSelect: store.elevateEdgesOnSelect,
      onerror: store.onError,
    };

    if (store.onlyRenderVisibleElements) {
      return getLayoutedEdges({
        ...options,
        onlyRenderVisible: true,
        visibleNodes: visibleNodesMap(),
        transform: transform(),
        width: store.width ?? 0,
        height: store.height ?? 0,
      });
    }

    return getLayoutedEdges(options as EdgeLayoutAllOptions<NodeType, EdgeType>);
  }, new Map<string, EdgeLayouted<EdgeType>>());

  const visibleEdgeIds = createMemo(() => {
    return Array.from(visibleEdgesMap().values()).map((edge) => edge.id);
  });

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Methods                                    */
  /*                                                                                */
  /**********************************************************************************/

  const initiateFitView = async () => {
    if (!store.panZoom) return false;

    return fitViewport(
      {
        nodes: nodeLookup,
        width: store.width,
        height: store.height,
        panZoom: store.panZoom,
        minZoom: store.minZoom,
        maxZoom: store.maxZoom,
      },
      fitViewOptions(),
    );
  };

  const updateSystemNodes = () => {
    return batch(() => {
      return adoptUserNodes(store.nodes, nodeLookup, parentLookup, {
        nodeOrigin: store.nodeOrigin,
        nodeExtent: store.nodeExtent,
        elevateNodesOnSelect: store.elevateNodesOnSelect,
        checkEquality: false, // recompute internal nodes
      });
    });
  };

  const nodesInitialized = () => {
    const result = updateSystemNodes();

    if (store.fitViewPromise) {
      if (store.fitViewOptions?.duration) {
        void initiateFitView();
      } else {
        queueMicrotask(() => {
          void initiateFitView();
        });
      }
    }

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
    setViewport(config().initialViewport ?? { x: 0, y: 0, zoom: 1 });
    setAriaLiveMessage("");
    setSnapGrid(undefined);
  };

  const fitView = async (options?: FitViewOptions) => {
    if (!store.panZoom) return false;

    if (store.fitViewPromise) {
      const result = await store.fitViewPromise;
      return result;
    }

    setFitViewOptions(options);

    const fitViewPromise = initiateFitView();

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    setFitViewPromise(fitViewPromise);

    const result = await fitViewPromise;

    batch(() => {
      setFitViewPromise(undefined);
      setFitViewOptions(undefined);
    });

    return result;
  };

  const addEdge = (edgeParams: EdgeType | Connection) => {
    edgesMemo.set((edges) => systemAddEdge(edgeParams, edges));
  };

  const updateNodePositions = (
    nodeDragItems: Map<string, NodeDragItem | InternalNodeBase<NodeType>>,
    dragging = false,
  ) => {
    nodesMemo.set(
      (node) => nodeDragItems.has(node.id),
      produce((node) => {
        node.dragging = dragging;
        node.position = nodeDragItems.get(node.id)!.position;
      }),
    );
  };

  let pendingEntries: InternalUpdateEntry[] | undefined = undefined;

  const requestUpdateNodeInternals = (updateEntries: InternalUpdateEntry[]) => {
    if (pendingEntries) {
      pendingEntries.push(...updateEntries);
      return;
    }

    pendingEntries = updateEntries;

    requestIdleCallback(() => {
      batch(() => {
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
        });

        if (store.fitViewPromise) {
          void store.fitViewPromise;
        }

        const nodeToChange = changes.reduce<Map<string, NodeDimensionChange | NodePositionChange>>(
          (acc, change) => {
            const node = nodeLookup.get(change.id)?.internals.userNode;

            if (!node) return acc;

            acc.set(node.id, change);

            return acc;
          },
          new Map(),
        );

        nodesMemo.set(
          (node) => nodeToChange.has(node.id),
          produce((node) => {
            const change = nodeToChange.get(node.id)!;

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
          }),
        );
      });
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
      nodesMemo.set(
        (node) => nodesToUnselect.has(node.id),
        produce((node) => {
          node.selected = false;
        }),
      );
    }

    const edgesToUnselect = new Set((edges ? edges : store.edges).map(({ id }) => id));

    if (edgesToUnselect.size) {
      edgesMemo.set(
        (edge) => edgesToUnselect.has(edge.id),
        produce((edge) => {
          edge.selected = false;
        }),
      );
    }
  };

  const addSelectedNodes = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;
    const selectState = new Map<string, boolean>();

    nodesMemo.set(
      (node) => {
        const nodeWillBeSelected = ids.includes(node.id);

        const selected = isMultiSelection
          ? node.selected || nodeWillBeSelected
          : nodeWillBeSelected;

        selectState.set(node.id, selected);

        return node.selected !== selected;
      },
      produce((node) => {
        // we need to mutate the node here in order to have the correct selected state in the drag handler
        const internalNode = nodeLookup.get(node.id);
        if (internalNode) internalNode.selected = selectState.get(node.id)!;
        node.selected = selectState.get(node.id)!;
      }),
    );

    if (!isMultiSelection) {
      unselectNodesAndEdges({ nodes: [] });
    }
  };

  const addSelectedEdges = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;
    const edgeSelectState = new Map<string, boolean>();

    edgesMemo.set(
      (edge) => {
        const edgeWillBeSelected = ids.includes(edge.id);
        const selected = isMultiSelection
          ? edge.selected || edgeWillBeSelected
          : edgeWillBeSelected;

        edgeSelectState.set(edge.id, selected);

        return edge.selected !== selected;
      },
      produce((edge) => {
        edge.selected = edgeSelectState.get(edge.id)!;
      }),
    );

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

    batch(() => {
      setSelectionRect(undefined);
      setSelectionRectMode(undefined);
    });

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

    batch(() => {
      setSelectionRect(undefined);
      setSelectionRectMode(undefined);
    });

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

  createEffect(() => {
    const _panZoom = panZoom();
    if (!_panZoom) return;

    createEffect(() => {
      _panZoom.setScaleExtent([store.minZoom, store.maxZoom]);
    });

    createEffect(() => {
      _panZoom.setTranslateExtent(store.translateExtent);
    });
  });

  createEffect(
    on(
      () => deepTrack(store.nodes),
      () => updateSystemNodes(),
    ),
  );

  createEffect(
    on(
      () => deepTrack(store.edges),
      () => {
        batch(() => {
          updateConnectionLookup(connectionLookup, edgeLookup, store.edges);
        });
      },
    ),
  );

  // TODO: Add viewportInitialized to store
  return {
    store,
    nodeLookup,
    edgeLookup,
    parentLookup,
    connectionLookup,
    actions: {
      nodesInitialized,
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
        return edgesMemo.set;
      },
      setElementsSelectable,
      setHeight,
      setMultiselectionKeyPressed,
      get setNodes() {
        return nodesMemo.set;
      },
      setNodesConnectable,
      setNodesDraggable,
      setPanActivationKeyPressed,
      setPanZoom,
      setSelectionKeyPressed,
      setSelectionRect,
      setSelectionRectMode,
      setViewport,
      setWidth,
      setZoomActivationKeyPressed,
      updateSystemNodes,

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
