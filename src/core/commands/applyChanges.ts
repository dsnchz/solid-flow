import type {
  DimensionChange,
  EdgeChangeset,
  NodeChangeset,
  NodeDragItem,
  XYPosition,
} from "@xyflow/system";

import type { Edge, Node } from "@/types";

import type { FlowCommands } from "../flowState";
import type { SelectionDelta } from "./selection";

/** The flow's own row writers, which the appliers reuse. */
export type ChangeWriters<NodeType extends Node, EdgeType extends Edge> = {
  readonly writeNodePositions: (
    items: Map<string, Pick<NodeDragItem, "position">>,
    dragging: boolean,
  ) => void;
  readonly writeNode: FlowCommands<NodeType, EdgeType>["updateNode"];
  readonly writeEdge: FlowCommands<NodeType, EdgeType>["updateEdge"];
  readonly writeNodeChanges: (changes: DimensionChange[]) => void;
  readonly writeSelectionDelta: (kind: "nodes" | "edges", delta: SelectionDelta) => void;
  readonly insertNodes: (added: readonly { item: NodeType; index?: number }[]) => void;
  readonly insertEdges: (added: readonly { item: EdgeType; index?: number }[]) => void;
  readonly removeNodes: (ids: ReadonlySet<string>) => void;
  readonly removeEdges: (ids: ReadonlySet<string>) => void;
};

type Shared<T extends Node | Edge> = {
  adds: { item: T; index?: number }[];
  select: string[];
  deselect: string[];
  removes: Set<string>;
};

/**
 * Writes the changes left in an onNodesChange / onEdgesChange changeset
 * through the flow's own writers, never as a new array (Svelte Flow 2's
 * `applyTo`): the per-row writes, the sidecars that make optimistic stores
 * compose, and the gesture write paths stay the ones every other write uses.
 * Order: additions first (later changes may target them), field writes,
 * selection, and removals last (a removal wins over anything else on the row).
 */
export const createChangeAppliers = <NodeType extends Node, EdgeType extends Edge>(
  writers: ChangeWriters<NodeType, EdgeType>,
) => {
  const finish = <T extends Node | Edge>(
    kind: "nodes" | "edges",
    { select, deselect, removes }: Shared<T>,
  ) => {
    if (select.length > 0 || deselect.length > 0) {
      writers.writeSelectionDelta(kind, { select, deselect });
    }
    if (removes.size > 0) {
      if (kind === "nodes") writers.removeNodes(removes);
      else writers.removeEdges(removes);
    }
  };

  const applyNodeChanges = (changes: NodeChangeset<NodeType>) => {
    const shared: Shared<NodeType> = { adds: [], select: [], deselect: [], removes: new Set() };
    const dragged = new Map<string, { position: XYPosition }>();
    const released = new Map<string, { position: XYPosition }>();
    const dimensions: DimensionChange[] = [];
    const rest: (() => void)[] = [];

    for (const change of changes) {
      switch (change.type) {
        case "add":
          shared.adds.push({ item: change.item, index: change.index });
          break;
        case "replace":
          rest.push(() => writers.writeNode(change.id, change.item, { replace: true }));
          break;
        case "update":
          rest.push(() => writers.writeNode(change.id, change.item));
          break;
        case "data": {
          const { data, replace } = change;
          rest.push(() =>
            writers.writeNode(change.id, (node) => ({
              ...node,
              data: replace ? data : { ...node.data, ...data },
            })),
          );
          break;
        }
        case "position": {
          const { position } = change;
          if (!position) break;
          if (change.dragging === undefined) {
            // Not a drag frame: a plain field write, as updateNode does.
            rest.push(() =>
              writers.writeNode(change.id, {
                position: { x: position.x, y: position.y },
              } as Partial<NodeType>),
            );
          } else {
            (change.dragging ? dragged : released).set(change.id, { position });
          }
          break;
        }
        case "dimensions":
          dimensions.push(change);
          break;
        case "select":
          (change.selected ? shared.select : shared.deselect).push(change.id);
          break;
        case "remove":
          shared.removes.add(change.id);
          break;
      }
    }

    if (shared.adds.length > 0) writers.insertNodes(shared.adds);
    for (const write of rest) write();
    if (dragged.size > 0) writers.writeNodePositions(dragged, true);
    if (released.size > 0) writers.writeNodePositions(released, false);
    if (dimensions.length > 0) writers.writeNodeChanges(dimensions);
    finish("nodes", shared);
  };

  const applyEdgeChanges = (changes: EdgeChangeset<EdgeType>) => {
    const shared: Shared<EdgeType> = { adds: [], select: [], deselect: [], removes: new Set() };
    const rest: (() => void)[] = [];

    for (const change of changes) {
      switch (change.type) {
        case "add":
          shared.adds.push({ item: change.item, index: change.index });
          break;
        case "replace":
          rest.push(() => writers.writeEdge(change.id, change.item, { replace: true }));
          break;
        case "update":
          rest.push(() => writers.writeEdge(change.id, change.item));
          break;
        case "data": {
          const { data, replace } = change;
          rest.push(() =>
            writers.writeEdge(change.id, (edge) => ({
              ...edge,
              data: replace ? data : { ...edge.data, ...data },
            })),
          );
          break;
        }
        case "select":
          (change.selected ? shared.select : shared.deselect).push(change.id);
          break;
        case "remove":
          shared.removes.add(change.id);
          break;
      }
    }

    if (shared.adds.length > 0) writers.insertEdges(shared.adds);
    for (const write of rest) write();
    finish("edges", shared);
  };

  return { nodes: applyNodeChanges, edges: applyEdgeChanges } as const;
};
