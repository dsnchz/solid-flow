import { getNodesInside, type NodeLookup, type Rect, type Transform } from "@xyflow/system";

import type { Edge, InternalNode, IsNodeSelectable, Node } from "@/types";

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
  /** Overlay-aware selection write (the selection sidecar, solid#3085). */
  readonly applySelectionSets: (nodeIds: ReadonlySet<string>, edgeIds: ReadonlySet<string>) => void;
  readonly unselectNodesAndEdges: () => void;
};

const isSetEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
};

/**
 * The box-selection gesture without its DOM: `arm` on pointerdown, `begin`
 * once the pointer passes the click distance, `update` with the screen rect
 * on every move or auto-pan step. Pane keeps the listeners, the rect and the
 * auto-pan loop.
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
  // What the gesture has written so far, to skip unchanged moves.
  let nodeIds: ReadonlySet<string> = new Set();
  let edgeIds: ReadonlySet<string> = new Set();

  return {
    /**
     * Pointerdown. Node geometry is frozen during a selection gesture
     * (RFC-4239 win #3): snapshot it so the per-move sweep only sees
     * candidates near the rect instead of every node.
     */
    arm: (): void => spatial.armFrom(deps.nodeGeometry),

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
      // Compare the first move against the selection as it is now, not
      // against what the previous gesture ended with.
      nodeIds = before.nodes;
      edgeIds = before.edges;
    },

    /** One move: select what the screen-space rect holds, writing only on change. */
    update: (rect: Rect): void => {
      const transform = deps.transform();
      const [tx, ty, zoom] = transform;
      spatial.setQueryRect({
        x: (rect.x - tx) / zoom,
        y: (rect.y - ty) / zoom,
        width: rect.width / zoom,
        height: rect.height / zoom,
      });
      const inside = getNodesInside(spatial, rect, transform, deps.partial(), true);
      // `isNodeSelectable` filters the candidates the rect found, never the
      // whole graph (upstream parity, xyflow#6004).
      const isNodeSelectable = deps.isNodeSelectable();
      const boxed = isNodeSelectable
        ? inside.filter((n) => isNodeSelectable(n.internals.userNode))
        : inside;
      const nextNodeIds = new Set([...before.nodes, ...boxed.map((n) => n.id)]);

      // Every selectable edge connected to a selected node.
      const nextEdgeIds = new Set(before.edges);
      for (const nodeId of nextNodeIds) {
        const nodeConnections = deps.connections[nodeId];
        if (!nodeConnections) continue;
        for (const { edgeId } of Object.values(nodeConnections)) {
          const edge = deps.edgeLookup[edgeId];
          if (edge && deps.isEdgeSelectable(edge)) nextEdgeIds.add(edgeId);
        }
      }

      if (isSetEqual(nodeIds, nextNodeIds) && isSetEqual(edgeIds, nextEdgeIds)) return;
      nodeIds = nextNodeIds;
      edgeIds = nextEdgeIds;
      deps.applySelectionSets(nodeIds, edgeIds);
    },

    /** Nodes the box holds (with the kept selection), for the end-of-gesture rect mode. */
    get selectedNodeCount(): number {
      return nodeIds.size;
    },
  };
};
