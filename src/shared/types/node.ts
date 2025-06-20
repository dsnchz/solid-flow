import type {
  InternalNodeBase,
  NodeBase as SystemNode,
  NodeProps as SystemNodeProps,
} from "@xyflow/system";
import type { JSX } from "solid-js";

import type { GraphTargetContextHandler, GraphTargetHandler } from "./events";

/**
 * The node data structure that gets used for the nodes prop.
 * @public
 */
export type Node<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  NodeType extends string = string,
> = SystemNode<NodeData, NodeType> & {
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
};

/**
 * The node data structure that gets used for internal nodes.
 * There are some data structures added under node.internal
 * that are needed for tracking some properties
 * @public
 */
export type InternalNode<NodeType extends Node = Node> = InternalNodeBase<NodeType>;

export type NodeProps<NodeType extends Node = Node> = SystemNodeProps<NodeType> & {
  readonly type: string;
};

export type NodeTypes = {
  [key: string]: <NodeType extends Node = Node>(props: NodeProps<NodeType>) => JSX.Element;
};

export type DefaultNodeOptions = Partial<Omit<Node, "id">>;

export type NodeEventCallbacks<NodeType extends Node = Node> = {
  readonly onNodeClick: GraphTargetHandler<NodeType>;
  readonly onNodeContextMenu: GraphTargetHandler<NodeType>;
  readonly onNodeMouseEnter: GraphTargetHandler<NodeType>;
  readonly onNodeMouseLeave: GraphTargetHandler<NodeType>;
  readonly onNodeMouseMove: GraphTargetHandler<NodeType>;
  readonly onNodeDrag: GraphTargetContextHandler<SystemNode>;
  readonly onNodeDragStart: GraphTargetContextHandler<SystemNode>;
  readonly onNodeDragStop: GraphTargetContextHandler<SystemNode>;
};
