import {
  evaluateAbsolutePosition,
  type FitBoundsOptions,
  getElementsToRemove,
  getNodesBounds,
  getOverlappingArea,
  getViewportForBounds,
  type HandleConnection,
  type HandleType,
  isRectObject,
  nodeToRect,
  pointToRendererPoint,
  type Rect,
  rendererPointToPoint,
  type SetCenterOptions,
  type Viewport,
  type ViewportHelperFunctionOptions,
  type XYPosition,
  type ZoomInOut,
} from "@xyflow/system";
import { batch } from "solid-js";
import { unwrap } from "solid-js/store";

import { useInternalSolidFlow } from "~/components/contexts";
import type { Edge, FitViewOptions, InternalNode, Node } from "~/types";
import { isEdge, isNode } from "~/utils";

/**
 * Hook for accessing the SvelteFlow instance.
 *
 * @public
 * @returns A set of helper functions
 */
export function useSolidFlow<NodeType extends Node = Node, EdgeType extends Edge = Edge>(): {
  /**
   * Zooms viewport in by 1.2.
   *
   * @param options.duration - optional duration. If set, a transition will be applied
   */
  zoomIn: ZoomInOut;
  /**
   * Zooms viewport out by 1 / 1.2.
   *
   * @param options.duration - optional duration. If set, a transition will be applied
   */
  zoomOut: ZoomInOut;
  /**
   * Returns an internal node by id.
   *
   * @param id - the node id
   * @returns the node or undefined if no node was found
   */
  getInternalNode: (id: string) => InternalNode<NodeType> | undefined;
  /**
   * Returns a node by id.
   *
   * @param id - the node id
   * @returns the node or undefined if no node was found
   */
  getNode: (id: string) => NodeType | undefined;
  /**
   * Returns nodes.
   *
   * @returns nodes array
   */
  getNodes: (ids?: string[]) => NodeType[];
  /**
   * Returns an edge by id.
   *
   * @param id - the edge id
   * @returns the edge or undefined if no edge was found
   */
  getEdge: (id: string) => EdgeType | undefined;
  /**
   * Returns edges.
   *
   * @returns edges array
   */
  getEdges: (ids?: string[]) => EdgeType[];
  /**
   * Add one or many nodes to your existing nodes array.
   *
   * @param payload - the nodes to add
   */
  addNodes: (payload: NodeType[] | NodeType) => void;
  /**
   * Add one or many edges to your existing edges array.
   *
   * @param payload - the edges to add
   */
  addEdges: (payload: EdgeType[] | EdgeType) => void;
  /**
   * Sets the current zoom level.
   *
   * @param zoomLevel - the zoom level to set
   * @param options.duration - optional duration. If set, a transition will be applied
   */
  setZoom: (zoomLevel: number, options?: ViewportHelperFunctionOptions) => Promise<boolean>;
  /**
   * Returns the current zoom level.
   *
   * @returns current zoom as a number
   */
  getZoom: () => number;
  /**
   * Sets the center of the view to the given position.
   *
   * @param x - x position
   * @param y - y position
   * @param options.zoom - optional zoom
   */
  setCenter: (x: number, y: number, options?: SetCenterOptions) => Promise<boolean>;
  /**
   * Sets the current viewport.
   *
   * @param viewport - the viewport to set
   * @param options.duration - optional duration. If set, a transition will be applied
   */
  setViewport: (viewport: Viewport, options?: ViewportHelperFunctionOptions) => Promise<boolean>;
  /**
   * Returns the current viewport.
   *
   * @returns Viewport
   */
  getViewport: () => Viewport;
  /**
   * Fits the view.
   *
   * @param options.padding - optional padding
   * @param options.includeHiddenNodes - optional includeHiddenNodes
   * @param options.minZoom - optional minZoom
   * @param options.maxZoom - optional maxZoom
   * @param options.duration - optional duration. If set, a transition will be applied
   * @param options.nodes - optional nodes to fit the view to
   */
  fitView: (options?: FitViewOptions<NodeType>) => Promise<boolean>;
  /**
   * Returns all nodes that intersect with the given node or rect.
   *
   * @param node - the node or rect to check for intersections
   * @param partially - if true, the node is considered to be intersecting if it partially overlaps with the passed node or rect
   * @param nodes - optional nodes array to check for intersections
   *
   * @returns an array of intersecting nodes
   */
  getIntersectingNodes: (
    nodeOrRect: NodeType | { id: NodeType["id"] } | Rect,
    partially?: boolean,
    nodesToIntersect?: NodeType[],
  ) => NodeType[];
  /**
   * Checks if the given node or rect intersects with the passed rect.
   *
   * @param node - the node or rect to check for intersections
   * @param area - the rect to check for intersections
   * @param partially - if true, the node is considered to be intersecting if it partially overlaps with the passed react
   *
   * @returns true if the node or rect intersects with the given area
   */
  isNodeIntersecting: (
    nodeOrRect: NodeType | { id: NodeType["id"] } | Rect,
    area: Rect,
    partially?: boolean,
  ) => boolean;
  /**
   * Fits the view to the given bounds .
   *
   * @param bounds - the bounds ({ x: number, y: number, width: number, height: number }) to fit the view to
   * @param options.padding - optional padding
   */
  fitBounds: (bounds: Rect, options?: FitBoundsOptions) => Promise<boolean>;
  /**
   * Deletes nodes and edges.
   *
   * @param params.nodes - optional nodes array to delete
   * @param params.edges - optional edges array to delete
   *
   * @returns a promise that resolves with the deleted nodes and edges
   */
  deleteElements: ({
    nodes,
    edges,
  }: {
    nodes?: (Partial<NodeType> & { id: string })[];
    edges?: (Partial<EdgeType> & { id: string })[];
  }) => Promise<{ deletedNodes: NodeType[]; deletedEdges: EdgeType[] }>;
  /**
   * Converts a screen / client position to a flow position.
   *
   * @param clientPosition - the screen / client position. When you are working with events you can use event.clientX and event.clientY
   * @param options.snapToGrid - if true, the converted position will be snapped to the grid
   * @returns position as { x: number, y: number }
   *
   * @example
   * const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
   */
  screenToFlowPosition: (
    clientPosition: XYPosition,
    options?: { snapToGrid: boolean },
  ) => XYPosition;
  /**
   * Converts a flow position to a screen / client position.
   *
   * @param flowPosition - the screen / client position. When you are working with events you can use event.clientX and event.clientY
   * @returns position as { x: number, y: number }
   *
   * @example
   * const clientPosition = flowToScreenPosition({ x: node.position.x, y: node.position.y })
   */
  flowToScreenPosition: (flowPosition: XYPosition) => XYPosition;
  /**
   * Updates a node.
   *
   * @param id - id of the node to update
   * @param nodeUpdate - the node update as an object or a function that receives the current node and returns the node update
   * @param options.replace - if true, the node is replaced with the node update, otherwise the changes get merged
   *
   * @example
   * updateNode('node-1', (node) => ({ position: { x: node.position.x + 10, y: node.position.y } }));
   */
  // updateNode: (
  //   id: string,
  //   nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeTyp>),
  //   options?: { replace: boolean }
  // ) => void;
  updateNode: (
    id: string,
    nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>),
    options?: { replace: boolean },
  ) => void;
  /**
   * Updates the data attribute of a node.
   *
   * @param id - id of the node to update
   * @param dataUpdate - the data update as an object or a function that receives the current data and returns the data update
   * @param options.replace - if true, the data is replaced with the data update, otherwise the changes get merged
   *
   * @example
   * updateNodeData('node-1', { label: 'A new label' });
   */
  updateNodeData: (
    id: string,
    dataUpdate: Partial<NodeType["data"]> | ((node: NodeType) => Partial<NodeType["data"]>),
    options?: { replace: boolean },
  ) => void;
  /**
   * Returns the nodes, edges and the viewport as a JSON object.
   *
   * @returns the nodes, edges and the viewport as a JSON object
   */
  /**
   * Updates an edge.
   *
   * @param id - id of the edge to update
   * @param edgeUpdate - the edge update as an object or a function that receives the current edge and returns the edge update
   * @param options.replace - if true, the edge is replaced with the edge update, otherwise the changes get merged
   *
   * @example
   * updateNode('node-1', (node) => ({ position: { x: node.position.x + 10, y: node.position.y } }));
   */
  updateEdge: (
    id: string,
    edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>),
    options?: { replace: boolean },
  ) => void;
  toObject: () => { nodes: NodeType[]; edges: EdgeType[]; viewport: Viewport };
  /**
   * Returns the bounds of the given nodes or node ids.
   *
   * @param nodes - the nodes or node ids to calculate the bounds for
   *
   * @returns the bounds of the given nodes
   */
  getNodesBounds: (nodes: (NodeType | InternalNode<NodeType> | string)[]) => Rect;
  /** Gets all connections for a given handle belonging to a specific node.
   *
   * @param type - handle type 'source' or 'target'
   * @param id - the handle id (this is only needed if you have multiple handles of the same type, meaning you have to provide a unique id for each handle)
   * @param nodeId - the node id the handle belongs to
   * @returns an array with handle connections
   */
  getHandleConnections: ({
    type,
    id,
    nodeId,
  }: {
    type: HandleType;
    nodeId: string;
    id?: string | null;
  }) => HandleConnection[];
} {
  const { store, actions, nodeLookup, edgeLookup, connectionLookup } = useInternalSolidFlow<
    NodeType,
    EdgeType
  >();

  const getNodeRect = (node: NodeType | { id: NodeType["id"] }): Rect | null => {
    const nodeToUse = isNode(node) ? node : nodeLookup.get(node.id)!;
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

  const updateNode = (
    id: string,
    nodeUpdate: Partial<NodeType> | ((node: NodeType) => Partial<NodeType>),
    options: { replace: boolean } = { replace: false },
  ) => {
    actions.setNodes(
      (node) => node.id === id,
      (node) => {
        const nextNode = typeof nodeUpdate === "function" ? nodeUpdate(node) : nodeUpdate;
        return options?.replace && isNode<NodeType>(nextNode) ? nextNode : { ...node, ...nextNode };
      },
    );
  };

  const updateEdge = (
    id: string,
    edgeUpdate: Partial<EdgeType> | ((edge: EdgeType) => Partial<EdgeType>),
    options: { replace: boolean } = { replace: false },
  ) => {
    actions.setEdges(
      (edge) => edge.id === id,
      (edge) => {
        const nextEdge = typeof edgeUpdate === "function" ? edgeUpdate(edge) : edgeUpdate;
        return options.replace && isEdge<EdgeType>(nextEdge) ? nextEdge : { ...edge, ...nextEdge };
      },
    );
  };

  const getInternalNode = (id: string) => nodeLookup.get(id);

  const addNodes = (payload: NodeType[] | NodeType) => {
    const newNodes = Array.isArray(payload) ? payload : [payload];
    actions.setNodes((nodes) => [...nodes, ...newNodes]);
  };

  const addEdges = (payload: EdgeType[] | EdgeType) => {
    const newEdges = Array.isArray(payload) ? payload : [payload];
    actions.setEdges((edges) => [...edges, ...newEdges]);
  };

  return {
    zoomIn: actions.zoomIn,
    zoomOut: actions.zoomOut,
    getInternalNode,
    setCenter: actions.setCenter,
    fitView: actions.fitView,
    getNode: (id) => getInternalNode(id)?.internals.userNode,
    getNodes: (ids) => (!ids ? store.nodes : getElements(nodeLookup, ids)),
    getEdge: (id) => edgeLookup.get(id),
    getEdges: (ids) => (!ids ? store.edges : getElements(edgeLookup, ids)),
    addNodes,
    addEdges,
    getViewport: () => unwrap(store.viewport),
    setViewport: async (nextViewport, options) => {
      const currentViewport = store.viewport;

      if (!store.panZoom) {
        return Promise.resolve(false);
      }

      await store.panZoom.setViewport(
        {
          x: nextViewport.x ?? currentViewport.x,
          y: nextViewport.y ?? currentViewport.y,
          zoom: nextViewport.zoom ?? currentViewport.zoom,
        },
        options,
      );

      return Promise.resolve(true);
    },
    getZoom: () => store.viewport.zoom,
    setZoom: (zoomLevel, options) => {
      const panZoom = store.panZoom;
      return panZoom
        ? panZoom.scaleTo(zoomLevel, { duration: options?.duration })
        : Promise.resolve(false);
    },
    fitBounds: async (bounds: Rect, options?: FitBoundsOptions) => {
      if (!store.panZoom) {
        return Promise.resolve(false);
      }

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

      return Promise.resolve(true);
    },
    getIntersectingNodes: (
      nodeOrRect: NodeType | { id: NodeType["id"] } | Rect,
      partially = true,
      nodesToIntersect?: NodeType[],
    ) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) {
        return [];
      }

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
    isNodeIntersecting: (
      nodeOrRect: NodeType | { id: NodeType["id"] } | Rect,
      area: Rect,
      partially = true,
    ) => {
      const isRect = isRectObject(nodeOrRect);
      const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);

      if (!nodeRect) {
        return false;
      }

      const overlappingArea = getOverlappingArea(nodeRect, area);
      const partiallyVisible = partially && overlappingArea > 0;

      return partiallyVisible || overlappingArea >= nodeRect.width * nodeRect.height;
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

      batch(() => {
        if (matchingEdges) {
          const remmainingEdges = store.edges.filter(
            (edge) => !matchingEdges.some(({ id }) => id === edge.id),
          );

          store.onEdgesDelete?.(matchingEdges);
          actions.setEdges(remmainingEdges);
        }

        if (matchingNodes) {
          const remmainingNodes = store.nodes.filter(
            (node) => !matchingNodes.some(({ id }) => id === node.id),
          );

          store.onNodesDelete?.(matchingNodes);
          actions.setNodes(remmainingNodes);
        }
      });

      return {
        deletedNodes: matchingNodes,
        deletedEdges: matchingEdges,
      };
    },
    screenToFlowPosition: (
      position: XYPosition,
      options: { snapToGrid: boolean } = { snapToGrid: true },
    ) => {
      if (!store.domNode) {
        return position;
      }

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
        _snapGrid !== null,
        _snapGrid || [1, 1],
      );
    },
    /**
     *
     * @param position
     * @returns
     */
    flowToScreenPosition: (position: XYPosition) => {
      if (!store.domNode) {
        return position;
      }

      const { x, y, zoom } = store.viewport;
      const { x: domX, y: domY } = store.domNode.getBoundingClientRect();
      const rendererPosition = rendererPointToPoint(position, [x, y, zoom]);

      return {
        x: rendererPosition.x + domX,
        y: rendererPosition.y + domY,
      };
    },

    toObject: () => {
      return structuredClone({
        nodes: [...unwrap(store.nodes)],
        edges: [...unwrap(store.edges)],
        viewport: { ...unwrap(store.viewport) },
      });
    },
    updateNode,
    updateNodeData: (id, dataUpdate, options) => {
      const node = nodeLookup.get(id)?.internals.userNode;

      if (!node) {
        return;
      }

      const nextData = typeof dataUpdate === "function" ? dataUpdate(node) : dataUpdate;
      updateNode(id, (node) => ({
        ...node,
        data: options?.replace ? nextData : { ...node.data, ...nextData },
      }));
    },
    updateEdge,
    getNodesBounds: (nodes) => {
      return getNodesBounds(nodes, { nodeLookup: nodeLookup, nodeOrigin: store.nodeOrigin });
    },
    getHandleConnections: ({ type, id, nodeId }) =>
      Array.from(connectionLookup.get(`${nodeId}-${type}-${id ?? null}`)?.values() ?? []),
  };
}

function getElements<NodeType extends Node = Node>(
  lookup: Map<string, InternalNode<NodeType>>,
  ids: string[],
): NodeType[];
function getElements<EdgeType extends Edge = Edge>(
  lookup: Map<string, EdgeType>,
  ids: string[],
): EdgeType[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getElements(lookup: Map<string, any>, ids: string[]): any[] {
  const result = [];

  for (const id of ids) {
    const item = lookup.get(id);

    if (item) {
      const element = "internals" in item ? item.internals?.userNode : item;
      result.push(element);
    }
  }

  return result;
}
