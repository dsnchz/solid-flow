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
import { batch, createEffect, createMemo, createSignal, mergeProps } from "solid-js";

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
import { createWritable } from "@/utils";

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

  const nodeLookup: NodeLookup<InternalNode<NodeType>> = new Map();
  const parentLookup: ParentLookup<InternalNode<NodeType>> = new Map();
  const edgeLookup: EdgeLookup<EdgeType> = new Map();
  const connectionLookup: ConnectionLookup = new Map();

  // eslint-disable-next-line solid/reactivity
  updateConnectionLookup(connectionLookup, edgeLookup, _props.edges);

  // eslint-disable-next-line solid/reactivity
  const startNodesInitialized = adoptUserNodes(_props.nodes, nodeLookup, parentLookup, {
    // eslint-disable-next-line solid/reactivity
    nodeExtent: _props.nodeExtent,
    // eslint-disable-next-line solid/reactivity
    nodeOrigin: _props.nodeOrigin,
    // eslint-disable-next-line solid/reactivity
    elevateNodesOnSelect: _props.elevateNodesOnSelect,
    checkEquality: true,
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
  const [fitViewResolver, setFitViewResolver] = createSignal<
    PromiseWithResolvers<boolean> | undefined
  >();
  const [elementsSelectable, setElementsSelectable] = createWritable(
    () => config().elementsSelectable,
  );
  const [fitViewQueued, setFitViewQueued] = createWritable<boolean>(() => config().fitViewQueued);
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

  const [nodes, setNodes] = createWritable(() => config().nodes);
  const [edges, setEdges] = createWritable(() => config().edges);

  const nodesState = createMemo(() => {
    // System call updates internal node state (nodeLookup, parentLookup)
    const initialized = adoptUserNodes(nodes(), nodeLookup, parentLookup, {
      nodeOrigin: config().nodeOrigin,
      nodeExtent: config().nodeExtent,
      elevateNodesOnSelect: config().elevateNodesOnSelect,
      checkEquality: false, // setting false recomputes internal nodes measurements
    });

    return { initialized, nodeLookup };
  });

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
    get fitViewResolver() {
      return fitViewResolver();
    },
    get fitViewQueued() {
      return fitViewQueued();
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
    get nodesInitialized() {
      return nodesState().initialized;
    },
    get nodeLookup() {
      return nodesState().nodeLookup;
    },
    get nodes() {
      const _nodes = nodes();

      if (store.fitViewQueued) {
        if (store.fitViewOptions?.duration) {
          void resolveFitView();
        } else {
          queueMicrotask(() => {
            void resolveFitView();
          });
        }
      }

      return _nodes;
    },
    get edges() {
      const _edges = edges();

      updateConnectionLookup(connectionLookup, edgeLookup, _edges);

      return _edges;
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

  const updateSystemNodes = () => {
    return batch(() => {
      return adoptUserNodes(store.nodes, store.nodeLookup, parentLookup, {
        nodeOrigin: store.nodeOrigin,
        nodeExtent: store.nodeExtent,
        elevateNodesOnSelect: store.elevateNodesOnSelect,
        checkEquality: false, // recompute internal nodes
      });
    });
  };

  const nodesInitialized = () => {
    const result = updateSystemNodes();

    if (store.fitViewQueued) {
      if (store.fitViewOptions?.duration) {
        void resolveFitView();
      } else {
        queueMicrotask(() => {
          void resolveFitView();
        });
      }
    }

    return result;
  };

  /**********************************************************************************/
  /*                                                                                */
  /*                               Visible Nodes/Edges                              */
  /*                                                                                */
  /**********************************************************************************/

  const visibleNodesMap = createMemo<Map<string, InternalNode>>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    store.nodes;

    if (store.onlyRenderVisibleElements) {
      return getVisibleNodes(store.nodeLookup, transform(), store.width ?? 0, store.height ?? 0);
    }
    return store.nodeLookup;
  });

  const visibleNodeIds = createMemo(() => {
    return Array.from(visibleNodesMap().values()).map((node) => node.id);
  });

  const visibleEdgesMap = createMemo<Map<string, EdgeLayouted<EdgeType>>>((previousEdges) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    store.nodes;

    const options = {
      edges: store.edges,
      defaultEdgeOptions: store.defaultEdgeOptions,
      previousEdges,
      nodeLookup: store.nodeLookup,
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

  const resolveFitView = async () => {
    if (!store.panZoom) return;

    await fitViewport(
      {
        nodes: store.nodeLookup,
        width: store.width,
        height: store.height,
        panZoom: store.panZoom,
        minZoom: store.minZoom,
        maxZoom: store.maxZoom,
      },
      fitViewOptions(),
    );

    store.fitViewResolver?.resolve(true);

    /**
     * wait for the fitViewport to resolve before deleting the resolver,
     * we want to reuse the old resolver if the user calls fitView again in the mean time
     */
    setFitViewQueued(false);
    setFitViewResolver(undefined);
    setFitViewOptions(undefined);
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
    // We either create a new Promise or reuse the existing one
    // Even if fitView is called multiple times in a row, we only end up with a single Promise
    const fitViewResolver = store.fitViewResolver ?? Promise.withResolvers<boolean>();

    setFitViewQueued(true);
    setFitViewOptions(options);
    setFitViewResolver(fitViewResolver);

    return fitViewResolver.promise;
  };

  const addEdge = (edgeParams: EdgeType | Connection) => {
    setEdges((edges) => systemAddEdge(edgeParams, edges));
  };

  const updateNodePositions = (
    nodeDragItems: Map<string, NodeDragItem | InternalNodeBase<NodeType>>,
    dragging = false,
  ) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        return nodeDragItems.has(node.id)
          ? { ...node, dragging, position: nodeDragItems.get(node.id)!.position }
          : node;
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
          store.nodeLookup,
          parentLookup,
          store.domNode,
          store.nodeOrigin,
        );

        if (!updatedInternals) return;

        updateAbsolutePositions(store.nodeLookup, parentLookup, {
          nodeOrigin: store.nodeOrigin,
          nodeExtent: store.nodeExtent,
        });
        if (store.fitViewQueued) {
          void resolveFitView();
        }

        const nodeToChange = changes.reduce<Map<string, NodeDimensionChange | NodePositionChange>>(
          (acc, change) => {
            const node = store.nodeLookup.get(change.id)?.internals.userNode;

            if (!node) return acc;

            acc.set(node.id, change);

            return acc;
          },
          new Map(),
        );

        setNodes((nodes) => {
          return nodes.map((node) => {
            if (!nodeToChange.has(node.id)) return node;

            const change = nodeToChange.get(node.id)!;

            switch (change.type) {
              case "dimensions": {
                let width = node.width;
                let height = node.height;

                if (change.setAttributes) {
                  width = change.dimensions?.width ?? width;
                  height = change.dimensions?.height ?? height;
                }

                return {
                  ...node,
                  width,
                  height,
                  measured: { ...node.measured, ...change.dimensions },
                };
              }
              case "position":
                return {
                  ...node,
                  position: change.position ?? node.position,
                };
              default:
                return node;
            }
          });
        });
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
      setNodes((nodes) => {
        return nodes.map((node) => {
          return !nodesToUnselect.has(node.id) ? node : { ...node, selected: false };
        });
      });
    }

    const edgesToUnselect = new Set((edges ? edges : store.edges).map(({ id }) => id));

    if (edgesToUnselect.size) {
      setEdges((edges) => {
        return edges.map((edge) => {
          return !edgesToUnselect.has(edge.id) ? edge : { ...edge, selected: false };
        });
      });
    }
  };

  const addSelectedNodes = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;
    const nodeLookup = store.nodeLookup;

    setNodes((nodes) => {
      return nodes.map((node) => {
        const nodeWillBeSelected = ids.includes(node.id);

        const selected = isMultiSelection
          ? node.selected || nodeWillBeSelected
          : nodeWillBeSelected;

        if (node.selected === selected) return node;

        // we need to mutate the node here in order to have the correct selected state in the drag handler
        const internalNode = nodeLookup.get(node.id);
        if (internalNode) internalNode.selected = selected;

        return { ...node, selected };
      });
    });

    if (!isMultiSelection) {
      unselectNodesAndEdges({ nodes: [] });
    }
  };

  const addSelectedEdges = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;

    setEdges((edges) => {
      return edges.map((edge) => {
        const edgeWillBeSelected = ids.includes(edge.id);

        const selected = isMultiSelection
          ? edge.selected || edgeWillBeSelected
          : edgeWillBeSelected;

        return edge.selected === selected ? edge : { ...edge, selected };
      });
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

    for (const node of store.nodeLookup.values()) {
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
        nodeLookup: store.nodeLookup,
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

  // TODO: Add viewportInitialized to store
  return {
    store,
    edgeLookup,
    parentLookup,
    connectionLookup,
    actions: {
      nodesInitialized,
      resetStoreValues,
      resolveFitView,
      requestUpdateNodeInternals,
      setAriaLabelConfig,
      setAriaLiveMessage,
      setClickConnectStartHandle,
      setConfig,
      setConnection,
      setDeleteKeyPressed,
      setDomNode,
      setDragging,
      setEdges,
      setElementsSelectable,
      setFitViewOptions,
      setFitViewQueued,
      setFitViewResolver,
      setHeight,
      setMultiselectionKeyPressed,
      setNodes,
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
