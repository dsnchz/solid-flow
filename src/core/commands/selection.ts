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

import type { RowIndex } from "../rowIndex";
import { emitFlowError, isEdgeSelectable } from "../rules";
import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";

/** Ids to select and to deselect, for {@link applySelectionDelta}. */
export type SelectionDelta = {
  readonly select: Iterable<string>;
  readonly deselect: Iterable<string>;
};

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
  /** Keyed selected-presence records (core/projections/selectedIds.ts). */
  readonly selectedNodeIds: Record<string, unknown>;
  readonly selectedEdgeIds: Record<string, unknown>;
  /** O(1) id → draft row resolution (see core/rowIndex.ts). */
  readonly nodeIndex: RowIndex<NodeType>;
  readonly edgeIndex: RowIndex<EdgeType>;
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
  selectedNodeIds,
  selectedEdgeIds,
  nodeIndex,
  edgeIndex,
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
      draft[kind][row.id] = { value, row };
    });
  };
  /**
   * Wholesale-set one axis's selection to `target`. Candidates are the DELTA
   * between the current presence record and the target — never a walk of the
   * graph: a 10k-row draft iteration per box-selection move (and per click
   * selection) was the round-14 audit's finding 2. Each candidate resolves by
   * index and is written only when its joined state actually differs.
   */
  const setSelection = <T extends { id: string; selected?: boolean }>(
    kind: "nodes" | "edges",
    setStore: StoreSetter<T[]>,
    index: RowIndex<T>,
    currentIds: readonly string[],
    target: ReadonlySet<string>,
  ) => {
    const candidates = new Set<string>(currentIds);
    for (const id of target) candidates.add(id);
    if (candidates.size === 0) return;
    // Loop fast path: a PLAIN snapshot of the overlay — per-row tracked
    // absent-key reads on the store cost a signal registration per node
    // (measured: a ~700ms first drag frame @10k, bench round 12).
    const overlay = snapshot(selectionOverlay[kind]);
    setStore((rows) => {
      for (const id of candidates) {
        const row = index.get(rows, id);
        if (!row) continue;
        const selected = target.has(id);
        if (joinSelected(row.selected, overlay[id]) !== selected) {
          writeOverlay(kind, row, selected);
          row.selected = selected;
        }
      }
      return undefined;
    });
  };

  const unselectNodesAndEdges = ({
    nodes: _nodes,
    edges,
  }: Partial<NodeGraph<NodeType, EdgeType>> = {}) => {
    // Targets come from the keyed selected-presence records, not a walk of
    // the whole graph: the drag-start profile @10k attributed ~515ms to this
    // function writing (then merely reading) every element — when almost
    // nothing is ever selected. Deselecting only what IS selected makes the
    // empty case free and the common case O(selected). Not the joined views
    // (`store.selectedNodes`): the node view is lazy, and reading it here
    // computed it — at drag start, and in reset() while the flow unmounts,
    // where the read left it queued for a sweep that never came and pinned
    // the whole unmounted flow (bench: retained after unmount 19 -> 276 MB).
    const requestedNodeIds = _nodes ? new Set(_nodes.map(({ id }) => id)) : null;
    const nodeTargets = Object.keys(selectedNodeIds).filter(
      (id) => !requestedNodeIds || requestedNodeIds.has(id),
    );
    if (nodeTargets.length) {
      setNodesStore((nodes) => {
        for (const id of nodeTargets) {
          const node = nodeIndex.get(nodes, id);
          if (!node) continue;
          writeOverlay("nodes", node, false);
          node.selected = false;
        }
        return undefined;
      });
    }

    const requestedEdgeIds = edges ? new Set(edges.map(({ id }) => id)) : null;
    const edgeTargets = Object.keys(selectedEdgeIds).filter(
      (id) => !requestedEdgeIds || requestedEdgeIds.has(id),
    );
    if (edgeTargets.length) {
      setEdgesStore((edges) => {
        for (const id of edgeTargets) {
          const edge = edgeIndex.get(edges, id);
          if (!edge) continue;
          writeOverlay("edges", edge, false);
          edge.selected = false;
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
    const currentIds = Object.keys(selectedNodeIds);
    // Multi-selection keeps what is selected; otherwise the ids replace it.
    const target = new Set(isMultiSelection ? [...currentIds, ...ids] : ids);
    setSelection("nodes", setNodesStore, nodeIndex, currentIds, target);

    if (!isMultiSelection) {
      unselectNodesAndEdges({ nodes: [] });
    }

    // Gesture boundary: the drag handler reads the selected state through
    // nodeLookup synchronously after selection (selectNodesOnDrag).
    flush();
  };

  const addSelectedEdges = (ids: string[]) => {
    const isMultiSelection = store.multiselectionKeyPressed;
    const currentIds = Object.keys(selectedEdgeIds);
    const target = new Set(isMultiSelection ? [...currentIds, ...ids] : ids);
    setSelection("edges", setEdgesStore, edgeIndex, currentIds, target);

    if (!isMultiSelection) {
      unselectNodesAndEdges({ edges: [] });
    }

    flush();
  };

  /**
   * A node click or selection key: selects it, or deselects a selected one
   * when asked to (Escape) or with the multiselection key. Returns whether
   * it deselected, so the keyboard caller can blur the node element.
   */
  const handleNodeSelection = (id: string, unselect?: boolean): boolean => {
    const node = nodeLookup.get(id)?.internals.userNode;

    if (!node) {
      emitFlowError(store.onError, "012", errorMessages["error012"](id));
      return false;
    }

    setSelectionRect(undefined);
    setSelectionRectMode(undefined);

    if (!nodeSelected(node)) {
      addSelectedNodes([id]);
      return false;
    }
    if (unselect || store.multiselectionKeyPressed) {
      unselectNodesAndEdges({ nodes: [node], edges: [] });
      return true;
    }
    return false;
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

    // Selected rows come from the presence record: O(selected), not a walk
    // of the whole lookup per arrow keypress.
    for (const id of Object.keys(selectedNodeIds)) {
      const node = nodeLookup.get(id);
      if (!node) continue;
      const isDraggable =
        node.draggable || (store.nodesDraggable && typeof node.draggable === "undefined");
      if (!isDraggable) continue;

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
  /**
   * Set only the given ids: O(changed), where setSelection is O(selected)
   * (it unions the presence record with the target and snapshots the
   * overlay). For a writer that tracks its own delta (the box selection,
   * whose box gains or loses a few nodes per move while thousands stay
   * selected). Writes are unconditional: an "already in that state" check
   * would read the committed overlay, which does not see an earlier write of
   * the same batch, and skip the second of two moves (select then deselect
   * before a flush). A row already in the state gets a same-value write and
   * an overlay entry the release effect clears. Unknown ids are skipped.
   */
  const setSelectionDelta = <T extends { id: string; selected?: boolean }>(
    kind: "nodes" | "edges",
    setStore: StoreSetter<T[]>,
    index: RowIndex<T>,
    delta: SelectionDelta | undefined,
  ) => {
    if (!delta) return;
    setStore((rows) => {
      const apply = (id: string, selected: boolean) => {
        const row = index.get(rows, id);
        if (!row) return;
        writeOverlay(kind, row, selected);
        row.selected = selected;
      };
      for (const id of delta.select) apply(id, true);
      for (const id of delta.deselect) apply(id, false);
      return undefined;
    });
  };

  const applySelectionDelta = ({
    nodes,
    edges,
  }: {
    nodes?: SelectionDelta;
    edges?: SelectionDelta;
  }) => {
    setSelectionDelta("nodes", setNodesStore, nodeIndex, nodes);
    setSelectionDelta("edges", setEdgesStore, edgeIndex, edges);
  };

  return {
    unselectNodesAndEdges,
    addSelectedNodes,
    addSelectedEdges,
    handleNodeSelection,
    handleEdgeSelection,
    moveSelectedNodes,
    applySelectionDelta,
  } as const;
};
