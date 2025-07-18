import {
  adoptUserNodes,
  calculateNodePosition,
  type Connection,
  type ConnectionState,
  type CoordinateExtent,
  errorMessages,
  initialConnection,
  type InternalNodeBase,
  type InternalNodeUpdate,
  type NodeDimensionChange,
  type NodeDragItem,
  type NodePositionChange,
  panBy as panBySystem,
  type SetCenterOptions,
  snapPosition,
  addEdge as systemAddEdge,
  updateNodeInternals as systemUpdateNodeInternals,
  updateAbsolutePositions,
  updateConnectionLookup,
  type ViewportHelperFunctionOptions,
  type XYPosition,
} from "@xyflow/system";
import { batch, createEffect, on } from "solid-js";
import { type ArrayFilterFn, produce, reconcile, type StoreSetter } from "solid-js/store";

import type { SolidFlowProps } from "@/components/SolidFlow/types";
import type { FitViewOptions } from "@/shared/types";
import type { Edge, InternalNode, Node, NodeGraph } from "@/types";
import { deepTrack } from "@/utils";

import { initializeSolidFlowStore } from "./initializeSolidFlowStore";

export const createSolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: Partial<SolidFlowProps<NodeType, EdgeType>>,
) => {
  const {
    store,
    nodeLookup,
    parentLookup,
    edgeLookup,
    connectionLookup,
    setStore,
    nodesInitialized,
    resolveFitView,
    resetStoreValues,
  } = initializeSolidFlowStore(props);

  createEffect(
    on(
      () => deepTrack(store.nodes),
      () => {
        adoptUserNodes(store.nodes, nodeLookup, parentLookup, {
          nodeExtent: store.nodeExtent,
          nodeOrigin: store.nodeOrigin,
          elevateNodesOnSelect: store.elevateNodesOnSelect,
          checkEquality: false,
        });
      },
    ),
  );

  function setNodes(nodes: NodeType[]): void;
  function setNodes(prev: (nodes: NodeType[]) => NodeType[]): void;
  function setNodes(mapper: StoreSetter<NodeType[], ["nodes"]>): void;
  function setNodes(
    filter: ArrayFilterFn<NodeType>,
    produceMutator: (node: NodeType) => NodeType,
  ): void;
  function setNodes(arg1: unknown, arg2?: unknown): void {
    if (arg2) {
      setStore("nodes", arg1 as ArrayFilterFn<NodeType>, arg2 as (node: NodeType) => NodeType);
    } else if (Array.isArray(arg1)) {
      setStore("nodes", reconcile(arg1 as NodeType[]));
    } else {
      setStore("nodes", arg1 as StoreSetter<NodeType[], ["nodes"]>);
    }
  }

  function setEdges(edges: EdgeType[]): void;
  function setEdges(mapper: StoreSetter<EdgeType[], ["edges"]>): void;
  function setEdges(filter: ArrayFilterFn<EdgeType>, mutator: (edge: EdgeType) => EdgeType): void;
  function setEdges(arg1: unknown, arg2?: unknown): void {
    if (arg2) {
      setStore("edges", arg1 as ArrayFilterFn<EdgeType>, arg2 as (edge: EdgeType) => EdgeType);
    } else if (Array.isArray(arg1)) {
      setStore("edges", reconcile(arg1 as EdgeType[]));
    } else {
      setStore("edges", arg1 as StoreSetter<EdgeType[], ["edges"]>);
    }

    batch(() => {
      updateConnectionLookup(connectionLookup, edgeLookup, store.edges);
    });
  }

  const fitView = async (options?: FitViewOptions) => {
    // We either create a new Promise or reuse the existing one
    // Even if fitView is called multiple times in a row, we only end up with a single Promise
    const fitViewResolver = store.fitViewResolver ?? Promise.withResolvers<boolean>();

    setStore(
      produce((store) => {
        store.fitViewQueued = true;
        store.fitViewOptions = options;
        store.fitViewResolver = fitViewResolver;
      }),
    );

    return fitViewResolver.promise;
  };

  const addEdge = (edgeParams: EdgeType | Connection) => {
    setEdges((edges) => systemAddEdge(edgeParams, edges));
  };

  const updateNodePositions = (
    nodeDragItems: Map<string, NodeDragItem | InternalNodeBase<NodeType>>,
    dragging = false,
  ) => {
    setNodes(
      (node) => nodeDragItems.has(node.id),
      produce((node) => {
        node.dragging = dragging;
        node.position = nodeDragItems.get(node.id)!.position;
      }),
    );
  };

  const updateNodeInternals = (updates: Map<string, InternalNodeUpdate>) => {
    const { changes, updatedInternals } = systemUpdateNodeInternals(
      updates,
      nodeLookup,
      parentLookup,
      store.domNode,
      store.nodeOrigin,
    );

    if (!updatedInternals) return;

    batch(() => {
      updateAbsolutePositions(nodeLookup, parentLookup, {
        nodeOrigin: store.nodeOrigin,
        nodeExtent: store.nodeExtent,
      });
    });

    if (store.fitViewQueued) {
      void resolveFitView();
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

    setNodes(
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

  const setMinZoom = (minZoom: number) => {
    if (!store.panZoom) return;

    store.panZoom.setScaleExtent([minZoom, store.maxZoom]);
    setStore("minZoom", minZoom);
  };

  const setMaxZoom = (maxZoom: number) => {
    if (!store.panZoom) return;

    store.panZoom.setScaleExtent([store.minZoom, maxZoom]);
    setStore("maxZoom", maxZoom);
  };

  const setTranslateExtent = (extent: CoordinateExtent) => {
    if (!store.panZoom) return;

    store.panZoom.setTranslateExtent(extent);
    setStore("translateExtent", extent);
  };

  const setPaneClickDistance = (distance: number) => {
    store.panZoom?.setClickDistance(distance);
  };

  const unselectNodesAndEdges = ({ nodes, edges }: Partial<NodeGraph<NodeType, EdgeType>> = {}) => {
    const nodesToUnselect = new Set((nodes ? nodes : store.nodes).map(({ id }) => id));

    if (nodesToUnselect.size) {
      setNodes(
        (node) => nodesToUnselect.has(node.id),
        produce((node) => {
          node.selected = false;
        }),
      );
    }

    const edgesToUnselect = new Set((edges ? edges : store.edges).map(({ id }) => id));

    if (edgesToUnselect.size) {
      setEdges(
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

    setNodes(
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

    setEdges(
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

    setStore(
      produce((store) => {
        store.selectionRect = undefined;
        store.selectionRectMode = undefined;
      }),
    );

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

    setStore(
      produce((store) => {
        store.selectionRect = undefined;
        store.selectionRectMode = undefined;
      }),
    );

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
    const viewport = store.viewport;

    return panBySystem({
      delta,
      panZoom: store.panZoom,
      transform: [viewport.x, viewport.y, viewport.zoom],
      translateExtent: store.translateExtent,
      width: store.width,
      height: store.height,
    });
  };

  const updateConnection = (connection: ConnectionState<InternalNode<NodeType>>) => {
    setStore("_connection", connection);
  };

  const cancelConnection = () => {
    setStore("_connection", { ...initialConnection });
  };

  const reset = () => {
    resetStoreValues();
    unselectNodesAndEdges();
  };

  // TODO: Add viewportInitialized to store
  const storeActions = {
    setStore,
    setNodes,
    setEdges,

    nodesInitialized,

    // Port Svelte Flow Actions to Solid Flow
    addEdge,
    updateNodePositions,
    updateNodeInternals,
    zoomIn,
    zoomOut,
    fitView,
    setCenter,
    setMinZoom,
    setMaxZoom,
    setTranslateExtent,
    setPaneClickDistance,
    unselectNodesAndEdges,
    addSelectedNodes,
    addSelectedEdges,
    handleNodeSelection,
    handleEdgeSelection,
    moveSelectedNodes,
    panBy,
    updateConnection,
    cancelConnection,
    reset,
  } as const;

  return {
    store,
    nodeLookup,
    edgeLookup,
    parentLookup,
    connectionLookup,
    ...storeActions,
  } as const;
};
