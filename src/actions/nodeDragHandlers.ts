import type { OnDrag } from "@xyflow/system";

import type { Node, NodeEvents } from "@/types";

type NodeDragEvents<NodeType extends Node> = Pick<
  NodeEvents<NodeType>,
  "onNodeDrag" | "onNodeDragStart" | "onNodeDragStop"
>;

/**
 * XYDrag's three drag callbacks for a node's (or the selection box's) user
 * handlers, each read when it fires. `withTarget: false` reports
 * `targetNode: null`: a selection-box drag has no single target node.
 * `onDrag` is only set when the user passed a handler: with it set, XYDrag
 * builds the handler params EVERY frame, a spread of every dragged node's
 * store proxy (audit finding 6: a 1000-node selection drag paid it with no
 * listener registered). Start and stop are always set (the drag helper needs
 * them; once per gesture).
 */
export const toNodeDragHandlers = <NodeType extends Node>(
  events: NodeDragEvents<NodeType>,
  withTarget: boolean,
): {
  onDrag: OnDrag<NodeType> | undefined;
  onDragStart: OnDrag<NodeType>;
  onDragStop: OnDrag<NodeType>;
} => ({
  onDrag: events.onNodeDrag
    ? (event, _, node, nodes) =>
        events.onNodeDrag?.({ event, targetNode: withTarget ? node : null, nodes })
    : undefined,
  onDragStart: (event, _, node, nodes) =>
    events.onNodeDragStart?.({ event, targetNode: withTarget ? node : null, nodes }),
  onDragStop: (event, _, node, nodes) =>
    events.onNodeDragStop?.({ event, targetNode: withTarget ? node : null, nodes }),
});
