import { getNodesInside, type NodeLookup, type Rect, type Transform } from "@xyflow/system";

import type { Edge, InternalNode, IsNodeSelectable, Node } from "@/types";

import type { SelectionDelta } from "./commands/selection";
import type { ConnectionsRecord } from "./projections/connections";
import { GestureSpatialLookup } from "./spatial/gestureLookup";

export type BoxSelectionDeps<NodeType extends Node, EdgeType extends Edge> = {
  readonly nodeLookup: NodeLookup<InternalNode<NodeType>>;
  /** Node rects in flow space; frozen into the spatial lookup at `arm`. */
  readonly nodeGeometry: ReadonlyMap<string, Rect>;
  readonly connections: ConnectionsRecord;
  readonly edgeLookup: Readonly<Record<string, EdgeType | undefined>>;
  /** The live selection, read at `begin` when the box keeps it. */
  readonly selectedNodeIds: Readonly<Record<string, unknown>>;
  readonly selectedEdgeIds: Readonly<Record<string, unknown>>;
  readonly transform: () => Transform;
  /** `selectionMode === "partial"`: overlapping nodes count, not only contained ones. */
  readonly partial: () => boolean;
  readonly isNodeSelectable: () => IsNodeSelectable<NodeType> | undefined;
  readonly isEdgeSelectable: (edge: EdgeType) => boolean;
  /** Overlay-aware write of the ids that flip (the selection sidecar, solid#3085). */
  readonly applySelectionDelta: (delta: { nodes?: SelectionDelta; edges?: SelectionDelta }) => void;
  readonly unselectNodesAndEdges: () => void;
};

/**
 * The box-selection gesture without its DOM: `arm` on pointerdown, `begin`
 * once the pointer passes the click distance, `update` with the screen rect
 * on every move or auto-pan step. Pane keeps the listeners, the rect and the
 * auto-pan loop.
 *
 * A move costs the containment query over the nodes near the rect plus
 * O(changed) for the rest: the boxed set is diffed against the previous
 * move's, every edge counts its selected endpoints, and only the ids that
 * flip are written. A zoomed-out box holds thousands of nodes and gains a
 * few per move.
 */
export const createBoxSelection = <NodeType extends Node, EdgeType extends Edge>(
  deps: BoxSelectionDeps<NodeType, EdgeType>,
) => {
  const spatial = new GestureSpatialLookup<InternalNode<NodeType>>(deps.nodeLookup, 400);
  // The selection present when the box began, kept while `keepPrevious`
  // (`deselectOnSelection: false`, upstream parity, xyflow#5960).
  let before: { nodes: ReadonlySet<string>; edges: ReadonlySet<string> } = {
    nodes: new Set(),
    edges: new Set(),
  };
  // The nodes the rect held at the previous move, kept ones excluded.
  let boxed = new Set<string>();
  // Selected endpoints per edge (kept and boxed nodes): an edge is selected
  // while its count is positive or it was kept from before.
  let edgeRefs = new Map<string, number>();
  // Edges of kept nodes that were not selected yet: the first move adds them.
  let pendingEdges: string[] = [];
  // Plain copies of the nodes the rect has reached this gesture. Geometry
  // and flags are frozen during a box gesture (see `arm`), so xyflow's
  // containment test reads each node through the store once per gesture,
  // not once per move (a zoomed-out box re-tests thousands every move).
  let frozen = new Map<string, InternalNode<NodeType>>();
  const freeze = (node: InternalNode<NodeType>): InternalNode<NodeType> => ({
    ...node,
    measured: { ...node.measured },
    internals: {
      ...node.internals,
      positionAbsolute: { ...node.internals.positionAbsolute },
    },
  });

  /** Counts `nodeId`'s selectable edges up or down; pushes the edges that flip. */
  const countEdges = (nodeId: string, step: 1 | -1, flipped: string[]) => {
    const nodeConnections = deps.connections[nodeId];
    if (!nodeConnections) return;
    for (const { edgeId } of Object.values(nodeConnections)) {
      const edge = deps.edgeLookup[edgeId];
      if (!edge || !deps.isEdgeSelectable(edge)) continue;
      const count = (edgeRefs.get(edgeId) ?? 0) + step;
      if (count === 0) edgeRefs.delete(edgeId);
      else edgeRefs.set(edgeId, count);
      const flips = step === 1 ? count === 1 : count === 0;
      if (flips && !before.edges.has(edgeId)) flipped.push(edgeId);
    }
  };

  return {
    /**
     * Pointerdown. Node geometry is frozen during a selection gesture
     * (RFC-4239 win #3): snapshot it so the per-move sweep only sees
     * candidates near the rect instead of every node.
     */
    arm: (): void => {
      spatial.armFrom(deps.nodeGeometry);
      frozen = new Map();
    },

    /** The pointer passed the click distance: the box takes over the selection. */
    begin: ({ keepPrevious }: { keepPrevious: boolean }): void => {
      if (keepPrevious) {
        before = {
          nodes: new Set(Object.keys(deps.selectedNodeIds)),
          edges: new Set(Object.keys(deps.selectedEdgeIds)),
        };
      } else {
        before = { nodes: new Set(), edges: new Set() };
        deps.unselectNodesAndEdges();
      }
      // Start from the selection as it is now, not from what the previous
      // gesture ended with.
      boxed = new Set();
      edgeRefs = new Map();
      pendingEdges = [];
      for (const nodeId of before.nodes) countEdges(nodeId, 1, pendingEdges);
    },

    /** One move: select what the screen-space rect holds, writing only what flips. */
    update: (rect: Rect): void => {
      const transform = deps.transform();
      const [tx, ty, zoom] = transform;
      spatial.setQueryRect({
        x: (rect.x - tx) / zoom,
        y: (rect.y - ty) / zoom,
        width: rect.width / zoom,
        height: rect.height / zoom,
      });
      const near = new Map<string, InternalNode<NodeType>>();
      for (const id of spatial.keys()) {
        let node = frozen.get(id);
        if (node === undefined) {
          const live = deps.nodeLookup.get(id);
          if (live === undefined) continue;
          node = freeze(live);
          frozen.set(id, node);
        }
        near.set(id, node);
      }
      const inside = getNodesInside(near, rect, transform, deps.partial(), true);
      // `isNodeSelectable` filters the candidates the rect found, never the
      // whole graph (upstream parity, xyflow#6004).
      const isNodeSelectable = deps.isNodeSelectable();
      const next = new Set<string>();
      for (const node of inside) {
        if (before.nodes.has(node.id)) continue;
        if (isNodeSelectable && !isNodeSelectable(node.internals.userNode)) continue;
        next.add(node.id);
      }

      const nodesOn: string[] = [];
      const nodesOff: string[] = [];
      const edgesOn = pendingEdges;
      const edgesOff: string[] = [];
      pendingEdges = [];
      for (const id of next) {
        if (boxed.has(id)) continue;
        nodesOn.push(id);
        countEdges(id, 1, edgesOn);
      }
      for (const id of boxed) {
        if (next.has(id)) continue;
        nodesOff.push(id);
        countEdges(id, -1, edgesOff);
      }
      boxed = next;

      if (nodesOn.length + nodesOff.length + edgesOn.length + edgesOff.length === 0) return;
      deps.applySelectionDelta({
        nodes: { select: nodesOn, deselect: nodesOff },
        edges: { select: edgesOn, deselect: edgesOff },
      });
    },

    /** Nodes the box holds (with the kept selection), for the end-of-gesture rect mode. */
    get selectedNodeCount(): number {
      return before.nodes.size + boxed.size;
    },
  };
};
