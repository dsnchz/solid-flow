import type { InternalNodeBase, NodeBase, NodeProps as NodePropsBase } from "@xyflow/system";
import type { Component } from "solid-js";

import type { GraphTargetContextHandler, GraphTargetHandler } from "./events";

/**
 * The node data structure that gets used for internal nodes.
 * There are some data structures added under node.internal
 * that are needed for tracking some properties
 * @public
 */
export type InternalNode<NodeType extends Node = Node> = InternalNodeBase<NodeType>;

/**
 * The node data structure that gets used for the nodes prop.
 * @public
 */
export type Node<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  NodeType extends string = string,
> = NodeBase<NodeData, NodeType> & {
  readonly class?: string;
  readonly style?: string;
};

// @todo: currently generics for nodes are not really supported
// let's fix `type: any` when we migrate to Svelte 5
export type NodeProps<NodeType extends Node = Node> = NodePropsBase<NodeType> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly type: any;
};

export type NodeTypes = Record<
  string,
  Component<
    NodeProps & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: any;
    }
  >
>;

export type DefaultNodeOptions = Partial<Omit<Node, "id">>;

export type BuiltInNode =
  | Node<{ label: string }, "input" | "output" | "default">
  | Node<Record<string, never>, "group">;

export type NodeEventCallbacks = {
  readonly onNodeClick: GraphTargetHandler<Node>;
  readonly onNodeContextMenu: GraphTargetHandler<Node>;
  readonly onNodeMouseEnter: GraphTargetHandler<Node>;
  readonly onNodeMouseLeave: GraphTargetHandler<Node>;
  readonly onNodeMouseMove: GraphTargetHandler<Node>;
  readonly onNodeDrag: GraphTargetContextHandler<Node>;
  readonly onNodeDragStart: GraphTargetContextHandler<Node>;
  readonly onNodeDragStop: GraphTargetContextHandler<Node>;
};

export type NodeEventMap = {
  readonly nodeclick: { node: Node; event: MouseEvent | TouchEvent };
  readonly nodecontextmenu: { node: Node; event: MouseEvent | TouchEvent };
  readonly nodedrag: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent };
  readonly nodedragstart: {
    targetNode: Node | null;
    nodes: Node[];
    event: MouseEvent | TouchEvent;
  };
  readonly nodedragstop: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent };
  readonly nodemouseenter: { node: Node; event: MouseEvent | TouchEvent };
  readonly nodemouseleave: { node: Node; event: MouseEvent | TouchEvent };
  readonly nodemousemove: { node: Node; event: MouseEvent | TouchEvent };
};
