import {
  addEdge as systemAddEdge,
  type Connection,
  getElementsToRemove,
  type NodeDragItem,
  type NodeLookup,
  type Viewport,
  type XYPosition,
} from "@xyflow/system";
import { snapshot, type StoreSetter } from "solid-js";

import type { Edge, InternalNode, Node, OnBeforeDelete, OnDelete } from "@/types";
import { isEdge, isNode } from "@/utils";

import { type DragOverlay } from "../dragOverlay";
import type { FlowCommands } from "../flowState";
import { type SelectionOverlay } from "../selectionOverlay";

/** The slice of the internal store the element commands read. */
type ElementStoreReads<NodeType extends Node, EdgeType extends Edge> = {
  // Mutable array types: these mirror the internal store's getters, and
  // system helpers (getElementsToRemove) take mutable arrays.
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
  readonly viewport: Viewport;
  readonly onBeforeDelete?: OnBeforeDelete<NodeType, EdgeType>;
  readonly onNodesDelete?: (nodes: NodeType[]) => void;
  readonly onEdgesDelete?: (edges: EdgeType[]) => void;
  readonly onDelete?: OnDelete<NodeType, EdgeType>;
};

export type ElementCommandDeps<NodeType extends Node, EdgeType extends Edge> = {
  readonly store: ElementStoreReads<NodeType, EdgeType>;
  readonly setNodesStore: StoreSetter<NodeType[]>;
  readonly setEdgesStore: StoreSetter<EdgeType[]>;
  readonly setSelectionOverlay: StoreSetter<{ nodes: SelectionOverlay; edges: SelectionOverlay }>;
  readonly setDragOverlay: StoreSetter<DragOverlay>;
  readonly nodeLookup: NodeLookup<InternalNode<NodeType>>;
  /** Whether the edges axis is controlled (the user's store owns membership). */
  readonly controlledEdges: () => boolean;
};

/**
 * Element command group: every structural or field mutation of nodes and
 * edges (add, update, delete, serialize), plus the two gesture-driven
 * writers (connection completion, drag positions). All writes are draft
 * writes on the graph roots; flow-driven fields (`selected`, drag positions)
 * are ALSO routed through the sidecars so commands compose over optimistic
 * stores exactly like gestures do (#3085).
 */
export const createElementCommands = <NodeType extends Node, EdgeType extends Edge>({
  store,
  setNodesStore,
  setEdgesStore,
  setSelectionOverlay,
  setDragOverlay,
  nodeLookup,
  controlledEdges,
}: ElementCommandDeps<NodeType, EdgeType>) => {
  const addEdge = (edgeParams: EdgeType | Connection) => {
    // Connection-completion writer (Handle's drag and click paths). On a
    // controlled edges axis membership belongs to the user's store: the
    // connection reaches them only through onConnect, and auto-inserting here
    // would pierce into their store and duplicate the documented adoption
    // push. Uncontrolled flows own membership, so the connection lands
    // directly.
    if (controlledEdges()) return;
    setEdgesStore((edges) => {
      const next = systemAddEdge(edgeParams, edges as EdgeType[]);
      // systemAddEdge returns the same array when the edge is invalid/duplicate
      if (next !== edges) {
        edges.push(next[next.length - 1]!);
      }
      return undefined;
    });
  };

  const updateNodePositions = (
    nodeDragItems: Map<string, Pick<NodeDragItem, "position">>,
    dragging = false,
  ) => {
    // Overlay write (authoritative for rendering) + best-effort row
    // write-through (parity: a plain store is live during the drag).
    // rowBefore is captured from the row's PRE-write value on the gesture's
    // first frame and carried through subsequent frames.
    setNodesStore((nodes) => {
      const writes: {
        id: string;
        position: XYPosition;
        rowBefore: XYPosition;
        row: NodeType;
      }[] = [];
      for (const node of nodes) {
        if (!nodeDragItems.has(node.id)) continue;
        const position = nodeDragItems.get(node.id)!.position;
        writes.push({ id: node.id, position, rowBefore: { ...node.position }, row: node });
        node.dragging = dragging;
        node.position = position;
      }
      setDragOverlay((draft) => {
        for (const { id, position, rowBefore, row } of writes) {
          draft[id] = { position, dragging, rowBefore: draft[id]?.rowBefore ?? rowBefore, row };
        }
      });
      return undefined;
    });
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
      // `selected` is flow state, not user data: route it through the
      // selection sidecar too, so updateNode-driven selection composes over
      // optimistic stores exactly like gesture-driven selection. The entry
      // holds the ORIGINAL row proxy, and `selected` is field-written onto it
      // BEFORE the slot replacement: on plain stores the field write commits
      // (entry confirms; the replacement row governs after release), on
      // optimistic stores both writes revert together and the overlay holds.
      // Capturing the replacement object instead would self-confirm — it
      // keeps the written value even after the slot reverts around it.
      if (nextNode.selected !== undefined) {
        node.selected = !!nextNode.selected;
        setSelectionOverlay((draft) => {
          draft.nodes[id] = { value: !!nextNode.selected, row: node };
        });
      }
      nodes[index] =
        options?.replace && isNode<NodeType>(nextNode) ? nextNode : { ...node, ...nextNode };
      return undefined;
    });
  };

  const commands = {
    addNodes: (payload) => {
      const newNodes = Array.isArray(payload) ? payload : [payload];
      setNodesStore((nodes) => [...nodes, ...newNodes]);
    },
    addEdges: (payload) => {
      const newEdges = Array.isArray(payload) ? payload : [payload];
      setEdgesStore((edges) => [...edges, ...newEdges]);
    },
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
        // `selected` routing — see updateNode for the original-row-proxy
        // capture rationale.
        if (nextEdge.selected !== undefined) {
          edge.selected = !!nextEdge.selected;
          setSelectionOverlay((draft) => {
            draft.edges[id] = { value: !!nextEdge.selected, row: edge };
          });
        }
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
    toObject: () => {
      return structuredClone({
        nodes: [...snapshot(store.nodes)],
        edges: [...snapshot(store.edges)],
        viewport: { ...snapshot(store.viewport) },
      });
    },
  } satisfies Partial<FlowCommands<NodeType, EdgeType>>;

  return { ...commands, addEdge, updateNodePositions } as const;
};
