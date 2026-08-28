import {
  calculateNodePosition,
  type CoordinateExtent,
  errorMessages,
  type NodeDragItem,
  type NodeLookup,
  type NodeOrigin,
  type OnError,
  type SnapGrid,
  snapPosition,
  type XYPosition,
} from "@xyflow/system";
import { flush, snapshot, type StoreSetter } from "solid-js";

import type { Edge, InternalNode, Node, NodeGraph } from "@/types";
import { emitFlowError, isEdgeSelectable } from "@/utils";

import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";

/** The slice of the internal store the selection commands read. */
type SelectionStoreReads<NodeType extends Node, EdgeType extends Edge> = {
  readonly nodes: readonly NodeType[];
  readonly edges: readonly EdgeType[];
  readonly multiselectionKeyPressed: boolean;
  readonly snapGrid?: SnapGrid;
  readonly nodesDraggable: boolean;
  readonly nodeExtent: CoordinateExtent;
  readonly nodeOrigin: NodeOrigin;
  readonly onError?: OnError;
  readonly elementsSelectable: boolean;
  readonly defaultEdgeOptions: { readonly selectable?: boolean };
};

export type SelectionCommandDeps<NodeType extends Node, EdgeType extends Edge> = {
  readonly store: SelectionStoreReads<NodeType, EdgeType>;
  readonly setNodesStore: StoreSetter<NodeType[]>;
  readonly setEdgesStore: StoreSetter<EdgeType[]>;
  readonly setSelectionRect: (rect: undefined) => void;
  readonly setSelectionRectMode: (mode: undefined) => void;
  readonly nodeLookup: NodeLookup<InternalNode<NodeType>>;
  readonly edgeLookup: Record<string, EdgeType>;
  readonly updateNodePositions: (
    updates: Map<string, Pick<NodeDragItem, "position">>,
    dragging?: boolean,
  ) => void;
  readonly selectionOverlay: { readonly nodes: SelectionOverlay; readonly edges: SelectionOverlay };
  readonly setSelectionOverlay: StoreSetter<{ nodes: SelectionOverlay; edges: SelectionOverlay }>;
};

/**
 * Selection command group (WP3): every mutation of `selected` state, plus
 * keyboard movement of the current selection. All writes are draft writes on
 * the graph roots; the `flush()` calls mark gesture boundaries where
 * @xyflow/system reads selection back synchronously through nodeLookup.
 */
export const createSelectionCommands = <NodeType extends Node, EdgeType extends Edge>({
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
}: SelectionCommandDeps<NodeType, EdgeType>) => {
  // The flow's view of an element's selection: overlay joined with the row.
  const nodeSelected = (node: { id: string; selected?: boolean }) =>
    joinSelected(node.selected, overlayEntry(selectionOverlay.nodes, node.id));
  const edgeSelected = (edge: { id: string; selected?: boolean }) =>
    joinSelected(edge.selected, overlayEntry(selectionOverlay.edges, edge.id));

  // Sidecar write + best-effort row write-through happen together; the
  // release effect in createFlowState deletes the entry once the row
  // confirms the value (see core/selectionOverlay.ts).
  const writeOverlay = (
    kind: "nodes" | "edges",
    row: { id: string; selected?: boolean },
    value: boolean,
  ) => {
    setSelectionOverlay((draft) => {
      draft[kind][row.id] = value;
    });
  };
  const unselectNodesAndEdges = ({
    nodes: _nodes,
    edges,
  }: Partial<NodeGraph<NodeType, EdgeType>> = {}) => {
    const nodesToUnselect = new Set((_nodes ? _nodes : store.nodes).map(({ id }) => id));

    if (nodesToUnselect.size) {
      setNodesStore((nodes) => {
        for (const node of nodes) {
          if (nodesToUnselect.has(node.id)) {
            writeOverlay("nodes", node, false);
            node.selected = false;
          }
        }
        return undefined;
      });
    }

    const edgesToUnselect = new Set((edges ?? store.edges).map(({ id }) => id));

    if (edgesToUnselect.size) {
      setEdgesStore((edges) => {
        for (const edge of edges) {
          if (edgesToUnselect.has(edge.id)) {
            writeOverlay("edges", edge, false);
            edge.selected = false;
          }
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
    const idSet = new Set(ids);

    // Loop fast path: a PLAIN snapshot of the overlay — per-row tracked
    // absent-key reads on the store cost a signal registration per node
    // (measured: a ~700ms first drag frame @10k, bench round 12).
    const nodeOverlay = snapshot(selectionOverlay.nodes);
    setNodesStore((nodes) => {
      for (const node of nodes) {
        const nodeWillBeSelected = idSet.has(node.id);
        const current = joinSelected(node.selected, nodeOverlay[node.id]);
        const selected = isMultiSelection ? current || nodeWillBeSelected : nodeWillBeSelected;

        if (current !== selected) {
          writeOverlay("nodes", node, selected);
          node.selected = selected;
        }
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
    const idSet = new Set(ids);

    const edgeOverlay = snapshot(selectionOverlay.edges);
    setEdgesStore((edges) => {
      for (const edge of edges) {
        const edgeWillBeSelected = idSet.has(edge.id);
        const current = joinSelected(edge.selected, edgeOverlay[edge.id]);
        const selected = isMultiSelection ? current || edgeWillBeSelected : edgeWillBeSelected;

        if (current !== selected) {
          writeOverlay("edges", edge, selected);
          edge.selected = selected;
        }
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
      emitFlowError(store.onError, "012", errorMessages["error012"](id));
      return;
    }

    setSelectionRect(undefined);
    setSelectionRectMode(undefined);

    if (!nodeSelected(node)) {
      addSelectedNodes([id]);
    } else if (unselect || (nodeSelected(node) && store.multiselectionKeyPressed)) {
      unselectNodesAndEdges({ nodes: [node], edges: [] });

      requestAnimationFrame(() => nodeRef?.blur());
    }
  };

  const handleEdgeSelection = (id: string) => {
    const edge = edgeLookup[id];

    if (!edge) {
      emitFlowError(store.onError, "012", errorMessages["error012"](id));
      return;
    }

    if (!isEdgeSelectable(edge, store)) return;

    setSelectionRect(undefined);
    setSelectionRectMode(undefined);

    if (!edgeSelected(edge)) {
      addSelectedEdges([id]);
    } else if (edgeSelected(edge) && store.multiselectionKeyPressed) {
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

  // Box-selection application (Pane): wholesale set the selected id sets.
  // Same overlay-aware write shape as the other commands — a direct row
  // write here would fight stale overlay entries from the gesture's
  // initial unselect.
  const applySelectionSets = (
    selectedNodeIds: ReadonlySet<string>,
    selectedEdgeIds: ReadonlySet<string>,
  ) => {
    const nodeOverlay = snapshot(selectionOverlay.nodes);
    setNodesStore((nodes) => {
      for (const node of nodes) {
        const selected = selectedNodeIds.has(node.id);
        if (joinSelected(node.selected, nodeOverlay[node.id]) !== selected) {
          writeOverlay("nodes", node, selected);
          node.selected = selected;
        }
      }
      return undefined;
    });
    const edgeOverlay = snapshot(selectionOverlay.edges);
    setEdgesStore((edges) => {
      for (const edge of edges) {
        const selected = selectedEdgeIds.has(edge.id);
        if (joinSelected(edge.selected, edgeOverlay[edge.id]) !== selected) {
          writeOverlay("edges", edge, selected);
          edge.selected = selected;
        }
      }
      return undefined;
    });
  };

  return {
    unselectNodesAndEdges,
    addSelectedNodes,
    addSelectedEdges,
    handleNodeSelection,
    handleEdgeSelection,
    moveSelectedNodes,
    applySelectionSets,
  } as const;
};
