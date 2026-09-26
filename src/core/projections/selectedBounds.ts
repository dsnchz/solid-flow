import { boxToRect, getBoundsOfBoxes, type Rect } from "@xyflow/system";

/** The plain rect a row derive reports for a node (see createGeometryFeed). */
export type NodeRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Bounding rect of the selected nodes, resolved through the KEYED
 * selected-presence record against the row derive's PLAIN geometry map:
 * O(selected) plain reads, no proxy traps. Inside a tracked scope the only
 * subscriptions are the record's membership and the geometry feed's tick
 * (the caller reads it) — a select-all @10k used to spend ~40 ms reading
 * every row's position and size through the store proxies (bench round 41).
 *
 * The previous derivation was `getInternalNodesBounds(nodeLookup, { filter:
 * selected })`: a tracked walk of the whole lookup that subscribed every node's
 * `selected` leaf and re-ran (tearing down and rebuilding ~20k subscriptions
 * @10k) on every frame of a selection-mode drag — the round-10 minimap
 * pathology on a path the listener bench never drove.
 *
 * Semantics mirror the system helper: union of the rows' rects, the zero
 * rect when nothing resolves.
 */
export const getSelectedNodesBounds = (
  selectedIds: Record<string, unknown>,
  geometry: { get(id: string): NodeRect | undefined },
): Rect => {
  let box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  let any = false;
  for (const id of Object.keys(selectedIds)) {
    const rect = geometry.get(id);
    if (!rect) continue;
    box = getBoundsOfBoxes(box, {
      x: rect.x,
      y: rect.y,
      x2: rect.x + rect.width,
      y2: rect.y + rect.height,
    });
    any = true;
  }
  return any ? boxToRect(box) : { x: 0, y: 0, width: 0, height: 0 };
};
