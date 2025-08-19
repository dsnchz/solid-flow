import type { Edge } from "./edge";
import type { Node } from "./node";

export type NodeEventWithPointer<T = PointerEvent, NodeType extends Node = Node> = ({
  node,
  event,
}: {
  node: NodeType;
  event: T;
}) => void;

export type NodesEventWithPointer<T = PointerEvent, NodeType extends Node = Node> = ({
  nodes,
  event,
}: {
  nodes: NodeType[];
  event: T;
}) => void;

export type NodeTargetEventWithPointer<T = PointerEvent, NodeType extends Node = Node> = ({
  targetNode,
  nodes,
  event,
}: {
  targetNode: NodeType | null;
  nodes: NodeType[];
  event: T;
}) => void;

export type NodeEvents<NodeType extends Node = Node> = {
  /** This event handler is called when a user clicks on a node. */
  onNodeClick?: NodeEventWithPointer<MouseEvent | TouchEvent, NodeType>;
  /** This event handler is called when a user right-clicks on a node. */
  onNodeContextMenu?: NodeEventWithPointer<MouseEvent, NodeType>;
  /** This event handler is called when a user drags a node. */
  onNodeDrag?: NodeTargetEventWithPointer<MouseEvent | TouchEvent, NodeType>;
  /** This event handler is called when a user starts to drag a node. */
  onNodeDragStart?: NodeTargetEventWithPointer<MouseEvent | TouchEvent, NodeType>;
  /** This event handler is called when a user stops dragging a node. */
  onNodeDragStop?: NodeTargetEventWithPointer<MouseEvent | TouchEvent, NodeType>;
  /** This event handler is called when the pointer of a user enters a node. */
  onNodePointerEnter?: NodeEventWithPointer<PointerEvent, NodeType>;
  /** This event handler is called when the pointer of a user leaves a node. */
  onNodePointerLeave?: NodeEventWithPointer<PointerEvent, NodeType>;
  /** This event handler is called when the pointer of a user moves over a node. */
  onNodePointerMove?: NodeEventWithPointer<PointerEvent, NodeType>;
};

export type NodeSelectionEvents<NodeType extends Node = Node> = {
  /** This event handler is called when a user right-clicks the selection box. */
  onSelectionContextMenu?: NodesEventWithPointer<PointerEvent, NodeType>;
  /** This event handler is called when a user clicks the selection box. */
  onSelectionClick?: NodesEventWithPointer<MouseEvent, NodeType>;
};

export type PaneEvents = {
  /** This event handler is called when a user clicks the pane. */
  onPaneClick?: ({ event }: { event: MouseEvent }) => void;
  /** This event handler is called when a user right-clicks the pane. */
  onPaneContextMenu?: ({ event }: { event: PointerEvent }) => void;
};

export type EdgeEvents<EdgeType extends Edge = Edge> = {
  /** This event handler is called when a user clicks an edge. */
  onEdgeClick?: ({ edge, event }: { edge: EdgeType; event: MouseEvent }) => void;
  /** This event handler is called when a user right-clicks an edge. */
  onEdgeContextMenu?: ({ edge, event }: { edge: EdgeType; event: PointerEvent }) => void;
  /** This event handler is called when the pointer of a user enters an edge. */
  onEdgePointerEnter?: ({ edge, event }: { edge: EdgeType; event: PointerEvent }) => void;
  /** This event handler is called when the pointer of a user enters an edge. */
  onEdgePointerLeave?: ({ edge, event }: { edge: EdgeType; event: PointerEvent }) => void;
};

export type DeleteEvents<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  onNodesDelete?: (nodes: NodeType[]) => void;
  onEdgesDelete?: (edges: EdgeType[]) => void;
};

export type OnSelectionDrag<NodeType extends Node = Node> = (
  event: MouseEvent,
  nodes: NodeType[],
) => void;
