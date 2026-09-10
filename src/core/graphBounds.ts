import { type Rect } from "@xyflow/system";

import type { NodeGeometry } from "./projections/internalNodes";

/**
 * Incremental graph-bounds sampling for per-frame consumers (the minimap
 * during a drag). Reads the plain geometry map the row derive maintains —
 * never the row proxies. Outside a drag, one pass over the map. During a
 * drag, the first frame partitions the graph into the moving rows (the
 * dragged ids and their descendants, via `parentId`) and one static box for
 * everything else; every later frame unions the static box with the moving
 * rows' current rects — O(moving) per frame instead of O(N).
 */
type Box = { x: number; y: number; x2: number; y2: number };
const EMPTY_BOX: Box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };

const union = (box: Box, r: NodeGeometry): Box => ({
  x: Math.min(box.x, r.x),
  y: Math.min(box.y, r.y),
  x2: Math.max(box.x2, r.x + r.width),
  y2: Math.max(box.y2, r.y + r.height),
});

const finiteRect = (box: Box): Rect | null =>
  Number.isFinite(box.x) && Number.isFinite(box.x2)
    ? { x: box.x, y: box.y, width: box.x2 - box.x, height: box.y2 - box.y }
    : null;

export type GraphBoundsDeps = {
  readonly geometry: ReadonlyMap<string, NodeGeometry>;
  readonly draggedIds: () => ReadonlySet<string>;
};

export type GraphBoundsSampler = {
  readonly sample: (dragging: boolean) => Rect | null;
};

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
};

export const createGraphBoundsSampler = ({
  geometry,
  draggedIds,
}: GraphBoundsDeps): GraphBoundsSampler => {
  let partition: { dragged: ReadonlySet<string>; staticBox: Box; moving: string[] } | null = null;

  const full = (): Rect | null => {
    let box = EMPTY_BOX;
    geometry.forEach((rect) => {
      box = union(box, rect);
    });
    return finiteRect(box);
  };

  const repartition = (dragged: ReadonlySet<string>) => {
    const movingById = new Map<string, boolean>();
    const isMoving = (id: string, rect: NodeGeometry): boolean => {
      const known = movingById.get(id);
      if (known !== undefined) return known;
      let moving = dragged.has(id);
      if (!moving && rect.parentId) {
        const parent = geometry.get(rect.parentId);
        moving = !!parent && isMoving(rect.parentId, parent);
      }
      movingById.set(id, moving);
      return moving;
    };

    let staticBox = EMPTY_BOX;
    const moving: string[] = [];
    geometry.forEach((rect, id) => {
      if (isMoving(id, rect)) moving.push(id);
      else staticBox = union(staticBox, rect);
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
        const rect = geometry.get(id);
        if (rect) box = union(box, rect);
      }
      return finiteRect(box);
    },
  };
};
