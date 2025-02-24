import {
  addEdge as addEdgeUtil,
  adoptUserNodes,
  type Connection,
  type ConnectionState,
  type CoordinateExtent,
  errorMessages,
  fitView as fitViewSystem,
  getDimensions,
  getElementsToRemove,
  getFitViewNodes,
  getNodesBounds as getNodesBoundsSystem,
  initialConnection,
  type InternalNodeUpdate,
  type NodeDimensionChange,
  type NodePositionChange,
  panBy as panBySystem,
  updateAbsolutePositions,
  updateConnectionLookup,
  updateNodeInternals as updateNodeInternalsSystem,
  type UpdateNodePositions,
  type ViewportHelperFunctionOptions,
  type XYPosition,
} from "@xyflow/system";
import { createEffect } from "solid-js";
import { produce } from "solid-js/store";

import type { Edge, EdgeTypes, FitViewOptions, Node, NodeGraph, NodeTypes } from "@/shared/types";

import {
  InitialEdgeTypesMap,
  initializeSolidFlowStore,
  InitialNodeTypesMap,
} from "./initializeSolidFlowStore";
import type { FlowStoreProps } from "./types";

type SetterCallback<T> = (value: T) => T;

export const createSolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: Partial<FlowStoreProps<NodeType, EdgeType>>,
) => {
  const [store, setStore] = initializeSolidFlowStore(props);

  // We now define custom public actions/setters for the store
  const setNodes = (nodesOrCallback: NodeType[] | SetterCallback<NodeType[]>) => {
    const nodes =
      typeof nodesOrCallback === "function" ? nodesOrCallback(store.nodes) : nodesOrCallback;

    const nextNodes = nodes.map((node) => ({
      ...store.defaultNodeOptions,
      ...node,
    }));

    adoptUserNodes(nextNodes, store.nodeLookup, store.parentLookup, {
      elevateNodesOnSelect: store.elevateNodesOnSelect,
      nodeOrigin: store.nodeOrigin,
      nodeExtent: store.nodeExtent,
      defaults: store.defaultNodeOptions,
      checkEquality: false,
    });

    setStore("nodes", nextNodes);
  };

  const setEdges = (edgesOrCallback: EdgeType[] | SetterCallback<EdgeType[]>) => {
    const edges =
      typeof edgesOrCallback === "function" ? edgesOrCallback(store.edges) : edgesOrCallback;

    const nextEdges = edges.map((edge) => ({
      ...store.defaultEdgeOptions,
      ...edge,
    }));

    updateConnectionLookup(store.connectionLookup, store.edgeLookup, nextEdges);

    setStore("edges", nextEdges);
  };

  const addEdge = (edgeParams: EdgeType | Connection) => {
    setEdges((edges) => addEdgeUtil(edgeParams, edges));
  };

  const setNodeTypes = (nodeTypes: NodeTypes) => {
    setStore("nodeTypes", { ...InitialNodeTypesMap, ...nodeTypes });
  };

  const setEdgeTypes = (edgeTypes: EdgeTypes) => {
    setStore("edgeTypes", { ...InitialEdgeTypesMap, ...edgeTypes });
  };

  const updateNodePositions: UpdateNodePositions = (nodeDragItems, dragging = false) => {
    setStore(
      "nodes",
      (node) => nodeDragItems.has(node.id),
      produce((node) => {
        node.dragging = dragging;
        node.position = nodeDragItems.get(node.id)!.position;
      }),
    );
  };

  const updateNodeInternals = (updates: Map<string, InternalNodeUpdate>) => {
    const nodeLookup = store.nodeLookup;
    const parentLookup = store.parentLookup;

    const { changes, updatedInternals } = updateNodeInternalsSystem(
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

    if (!store.fitViewOnInitDone && store.fitViewOnInit) {
      const fitViewOptions = store.fitViewOptions;
      const fitViewOnInitDone = fitViewSync({
        ...fitViewOptions,
        nodes: fitViewOptions?.nodes,
      });

      setStore("fitViewOnInitDone", fitViewOnInitDone);
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

    setStore(
      "nodes",
      (node) => nodeToChange.has(node.id),
      produce((node) => {
        const change = nodeToChange.get(node.id)!;

        switch (change.type) {
          case "dimensions": {
            const measured = { ...node.measured, ...change.dimensions };

            if (change.setAttributes) {
              node.width = change.dimensions?.width ?? node.width;
              node.height = change.dimensions?.height ?? node.height;
            }

            node.measured = measured;
            break;
          }
          case "position":
            node.position = change.position ?? node.position;
            break;
        }
      }),
    );

    if (!store.nodesInitialized) {
      setStore("nodesInitialized", true);
    }
  };

  const fitView = async (options?: FitViewOptions) => {
    const panZoom = store.panZoom;
    const domNode = store.domNode;

    if (!panZoom || !domNode) return false;

    const { width, height } = getDimensions(domNode);

    const fitViewNodes = getFitViewNodes(store.nodeLookup, options);

    return fitViewSystem(
      {
        nodes: fitViewNodes,
        width,
        height,
        minZoom: store.minZoom,
        maxZoom: store.maxZoom,
        panZoom,
      },
      options,
    );
  };

  const fitViewSync = (options?: FitViewOptions) => {
    const panZoom = store.panZoom;

    if (!panZoom) return false;

    const fitViewNodes = getFitViewNodes(store.nodeLookup, options);

    fitViewSystem(
      {
        nodes: fitViewNodes,
        width: store.width,
        height: store.height,
        minZoom: store.minZoom,
        maxZoom: store.maxZoom,
        panZoom,
      },
      options,
    );

    return fitViewNodes.size > 0;
  };

  const zoomBy = async (factor: number, options?: ViewportHelperFunctionOptions) => {
    return store.panZoom ? store.panZoom.scaleBy(factor, options) : false;
  };

  const zoomIn = (options?: ViewportHelperFunctionOptions) => zoomBy(1.2, options);
  const zoomOut = (options?: ViewportHelperFunctionOptions) => zoomBy(1 / 1.2, options);

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
      setStore(
        "nodes",
        (node) => nodesToUnselect.has(node.id),
        produce((node) => {
          node.selected = false;
        }),
      );
    }

    const edgesToUnselect = new Set((edges ? edges : store.edges).map(({ id }) => id));

    if (edgesToUnselect.size) {
      setStore(
        "edges",
        (edge) => edgesToUnselect.has(edge.id),
        produce((edge) => {
          edge.selected = false;
        }),
      );
    }
  };

  const removeNodesAndEdges = (graph: Partial<NodeGraph<NodeType, EdgeType>> = {}) => {
    const { nodes = [], edges = [] } = graph;

    if (nodes.length) {
      const nodesToRemove = new Set(nodes.map((mN) => mN.id));
      setStore("nodes", (nodes) => nodes.filter((node) => !nodesToRemove.has(node.id)));
    }

    if (edges.length) {
      const edgesToRemove = new Set(edges.map((mE) => mE.id));
      setStore("edges", (edges) => edges.filter((edge) => !edgesToRemove.has(edge.id)));
    }

    if (nodes.length || edges.length) {
      store.onDelete?.({ nodes, edges });
    }
  };

  const addSelectedNodes = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;

    setNodes((nodes) =>
      nodes.map((node) => {
        const nodeWillBeSelected = ids.includes(node.id);
        const selected = isMultiSelection
          ? node.selected || nodeWillBeSelected
          : nodeWillBeSelected;

        // we need to mutate the node here in order to have the correct selected state in the drag handler
        return { ...node, selected };
      }),
    );

    if (!isMultiSelection) {
      setEdges((es) =>
        es.map((edge) => ({
          ...edge,
          selected: false,
        })),
      );
    }
  };

  function addSelectedEdges(ids: string[]) {
    const isMultiSelection = store.multiselectionKeyPressed;

    setEdges((edges) =>
      edges.map((edge) => {
        const edgeWillBeSelected = ids.includes(edge.id);
        const selected = isMultiSelection
          ? edge.selected || edgeWillBeSelected
          : edgeWillBeSelected;

        return { ...edge, selected };
      }),
    );

    if (!isMultiSelection) {
      setNodes((ns) =>
        ns.map((node) => ({
          ...node,
          selected: false,
        })),
      );
    }
  }

  function handleNodeSelection(id: string) {
    const node = store.nodes?.find((n) => n.id === id);

    if (!node) {
      console.warn("012", errorMessages["error012"](id));
      return;
    }

    setStore(
      produce((store) => {
        store.selectionRect = null;
        store.selectionRectMode = null;
      }),
    );

    if (!node.selected) {
      addSelectedNodes([id]);
    } else if (node.selected && store.multiselectionKeyPressed) {
      unselectNodesAndEdges({ nodes: [node], edges: [] });
    }
  }

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

  const updateConnection = (connection: ConnectionState) => {
    setStore("connectionState", connection);
  };

  const cancelConnection = () => {
    setStore("connectionState", initialConnection);
  };

  const getNodesBounds = (nodes: Node[]) => {
    const _nodeLookup = store.nodeLookup;
    const _nodeOrigin = store.nodeOrigin;

    return getNodesBoundsSystem(nodes, { nodeLookup: _nodeLookup, nodeOrigin: _nodeOrigin });
  };

  const reset = () => {
    setStore(
      produce((store) => {
        store.fitViewOnInitDone = false;
        store.selectionRect = null;
        store.selectionRectMode = null;
        store.snapGrid = null;
        store.isValidConnection = () => true;
      }),
    );

    unselectNodesAndEdges();
    cancelConnection();
  };

  createEffect(() => {
    if (!store.deleteKeyPressed) return;

    getElementsToRemove<NodeType, EdgeType>({
      nodes: store.nodes,
      edges: store.edges,
      nodesToRemove: store.selectedNodes,
      edgesToRemove: store.selectedEdges,
      onBeforeDelete: store.onBeforeDelete,
    }).then(removeNodesAndEdges);
  });

  const storeActions = {
    setStore,
    setNodeTypes,
    setEdgeTypes,
    setNodes,
    addEdge,
    setEdges,
    addSelectedNodes,
    addSelectedEdges,
    updateNodePositions,
    updateNodeInternals,
    zoomIn,
    zoomOut,
    fitView,
    setMinZoom,
    setMaxZoom,
    setTranslateExtent,
    setPaneClickDistance,
    unselectNodesAndEdges,
    removeNodesAndEdges,
    handleNodeSelection,
    panBy,
    updateConnection,
    cancelConnection,
    reset,
    getNodesBounds,
  } as const;

  return { store, ...storeActions } as const;
};
