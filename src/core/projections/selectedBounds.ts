import { boxToRect, getBoundsOfBoxes, nodeToBox, type Rect } from "@xyflow/system";

import type { InternalNode, Node } from "@/types";

/**
 * Bounding rect of the selected nodes, resolved through the KEYED
 * selected-presence record: O(selected) lookups, and — inside a tracked scope —
 * O(selected) subscriptions (record membership + each selected row's slot,
 * `positionAbsolute` and `measured` leaves).
 *
 * The previous derivation was `getInternalNodesBounds(nodeLookup, { filter:
 * selected })`: a tracked walk of the whole lookup that subscribed every node's
 * `selected` leaf and re-ran (tearing down and rebuilding ~20k subscriptions
 * @10k) on every frame of a selection-mode drag — the round-10 minimap
 * pathology on a path the listener bench never drove.
 *
 * Semantics mirror the system helper: union of `nodeToBox` over the rows, the
 * zero rect when nothing resolves.
 */
export const getSelectedNodesBounds = <NodeType extends Node>(
  selectedIds: Record<string, unknown>,
  nodeLookup: { get(id: string): InternalNode<NodeType> | undefined },
): Rect => {
  let box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  let any = false;
  for (const id of Object.keys(selectedIds)) {
    const node = nodeLookup.get(id);
    if (!node) continue;
    box = getBoundsOfBoxes(box, nodeToBox(node));
    any = true;
  }
  return any ? boxToRect(box) : { x: 0, y: 0, width: 0, height: 0 };
};
