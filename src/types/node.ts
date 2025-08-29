import type { InternalNodeBase, NodeBase, NodeProps as NodePropsBase } from "@xyflow/system";
import type { JSX } from "solid-js";

import type { UnknownStruct } from "./custom";

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
  NodeData extends UnknownStruct = UnknownStruct,
  NodeType extends string | undefined = string | undefined,
> = NodeBase<NodeData, NodeType> & {
  class?: string;
  style?: JSX.CSSProperties;
  focusable?: boolean;
  /**
   * The ARIA role attribute for the node element, used for accessibility.
   * @default "group"
   */
  ariaRole?: JSX.HTMLAttributes<HTMLDivElement>["role"];

  /**
   * General escape hatch for adding custom attributes to the node's DOM element.
   */
  domAttributes?: Omit<
    JSX.HTMLAttributes<HTMLDivElement>,
    | "id"
    | "style"
    | "class"
    | "draggable"
    | "role"
    | "aria-label"
    | keyof JSX.HTMLAttributes<HTMLDivElement>
  >;
};

export type NodeProps<
  TData extends UnknownStruct = UnknownStruct,
  TType extends string | undefined = string | undefined,
> = NodePropsBase<Node<TData, TType>>;

export type NodeComponent<
  TData extends UnknownStruct = UnknownStruct,
  TType extends string | undefined = string | undefined,
> = (props: NodeProps<TData, TType>) => JSX.Element;

/**
 * Map of node types to their components.
 */
export type NodeTypes = {
  [K in string]: {
    bivarianceHack(props: NodeProps<Record<string, unknown>, string | undefined>): JSX.Element;
  }["bivarianceHack"];
};

export type BuiltInNodeTypes = {
  input: (props: NodeProps<{ label: string }, "input">) => JSX.Element;
  output: (props: NodeProps<{ label: string }, "output">) => JSX.Element;
  default: (props: NodeProps<{ label: string }, "default">) => JSX.Element;
  group: (props: NodeProps<Record<string, never>, "group">) => JSX.Element;
};
