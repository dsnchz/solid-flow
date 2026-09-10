import { boxToRect, getBoundsOfBoxes, nodeToBox, type Rect } from "@xyflow/system";

import type { InternalNode, Node } from "@/types";

type Box = { x: number; y: number; x2: number; y2: number };
const EMPTY_BOX: Box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };

const finiteRect = (box: Box): Rect | null => {
  const rect = boxToRect(box);
  // Pre-measurement graphs yield an Infinity rect; folding that into a
  // viewScale poisons it with NaN (which XYMinimap writes into the SHARED
  // panZoom viewport). Treat as "no bounds yet".
  return Number.isFinite(rect.x) && Number.isFinite(rect.width) ? rect : null;
};

export type GraphBoundsDeps<NodeType extends Node> = {
  readonly nodeLookup: {
    get(id: string): InternalNode<NodeType> | undefined;
    forEach(cb: (node: InternalNode<NodeType>, id: string) => void): void;
  };
  /** Ids the current gesture is writing positions for (the drag overlay's keys). */
  readonly draggedIds: () => ReadonlySet<string>;
};

export type GraphBoundsSampler = {
  /**
   * Bounding rect of the whole graph, or null while nothing is measured.
   * `dragging: false` is one full pass. `dragging: true` partitions the graph
   * ONCE per dragged-set (the dragged rows plus their descendants are the
   * MOVING set; everything else is unioned into a frozen static box) and then
   * costs O(moving) keyed reads per call — the per-frame path never walks.
   */
  readonly sample: (dragging: boolean) => Rect | null;
};

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
};

/**
 * Untracked graph-bounds sampling for the minimap (bench round 15, finding
 * 3). The full pass reads ~7 proxy leaves per row — ~38ms @10k, which the
 * previous design paid on EVERY animation frame of a drag (invisible to the
 * listener-timing bench) and every 500ms forever. Callers pair the per-drag
 * incremental path with a change-driven idle sample (the core geometry
 * version) instead of a periodic scan.
 */
export const createGraphBoundsSampler = <NodeType extends Node>({
  nodeLookup,
  draggedIds,
}: GraphBoundsDeps<NodeType>): GraphBoundsSampler => {
  let partition: { dragged: ReadonlySet<string>; staticBox: Box; moving: string[] } | null = null;

  const full = (): Rect | null => {
    let box = EMPTY_BOX;
    nodeLookup.forEach((node) => {
      box = getBoundsOfBoxes(box, nodeToBox(node));
    });
    return finiteRect(box);
  };

  const repartition = (dragged: ReadonlySet<string>) => {
    // Moving = dragged or any ancestor dragged (children ride along with a
    // dragged parent in the derived positions). Memoized per pass so nested
    // chains resolve once each; order-independent.
    const movingById = new Map<string, boolean>();
    const isMoving = (node: InternalNode<NodeType>): boolean => {
      const known = movingById.get(node.id);
      if (known !== undefined) return known;
      let moving = dragged.has(node.id);
      if (!moving && node.parentId) {
        const parent = nodeLookup.get(node.parentId);
        moving = !!parent && isMoving(parent);
      }
      movingById.set(node.id, moving);
      return moving;
    };

    let staticBox = EMPTY_BOX;
    const moving: string[] = [];
    nodeLookup.forEach((node) => {
      if (isMoving(node)) moving.push(node.id);
      else staticBox = getBoundsOfBoxes(staticBox, nodeToBox(node));
    });
    partition = { dragged: new Set(dragged), staticBox, moving };
  };

  return {
    sample: (dragging) => {
      if (!dragging) {
        partition = null;
        return full();
      }
      const dragged = draggedIds();
      if (!partition || !sameSet(partition.dragged, dragged)) repartition(dragged);
      let box = partition!.staticBox;
      for (const id of partition!.moving) {
        const node = nodeLookup.get(id);
        if (node) box = getBoundsOfBoxes(box, nodeToBox(node));
      }
      return finiteRect(box);
    },
  };
};
