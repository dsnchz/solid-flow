import type {
  Connection,
  EdgeChange,
  FitViewOptionsBase,
  Handle,
  HandleProps as HandlePropsSystem,
  NodeChange,
  OnBeforeDeleteBase,
  XYPosition,
} from "@xyflow/system";

import type { Edge } from "./edge";
import type { Node } from "./node";

/**
 * This type can be used to type the `onNodesChange` function with a custom node type.
 *
 * @public
 *
 * @example
 *
 * ```ts
 * const onNodesChange: OnNodesChange<MyNodeType> = useCallback((changes) => {
 *  setNodes((nodes) => applyNodeChanges(nodes, changes));
 * },[]);
 * ```
 */
export type OnNodesChange<NodeType extends Node = Node> = (changes: NodeChange<NodeType>[]) => void;

/**
 * This type can be used to type the `onEdgesChange` function with a custom edge type.
 *
 * @public
 *
 * @example
 *
 * ```ts
 * const onEdgesChange: OnEdgesChange<MyEdgeType> = useCallback((changes) => {
 *  setEdges((edges) => applyEdgeChanges(edges, changes));
 * },[]);
 * ```
 */
export type OnEdgesChange<EdgeType extends Edge = Edge> = (changes: EdgeChange<EdgeType>[]) => void;

export type OnNodesDelete<NodeType extends Node = Node> = (nodes: NodeType[]) => void;
export type OnEdgesDelete<EdgeType extends Edge = Edge> = (edges: EdgeType[]) => void;

export type ShortcutModifier = "alt" | "ctrl" | "meta" | "shift";
export type ShortcutModifierDefinition =
  | ShortcutModifier
  | ShortcutModifier[]
  | ShortcutModifier[][];

export type KeyModifier = ShortcutModifierDefinition;

export type KeyDefinitionObject = {
  readonly key: string;
  readonly modifier?: KeyModifier;
};

export type KeyDefinition = string | KeyDefinitionObject;

export type ConnectionData = {
  readonly connectionPosition: XYPosition | null;
  readonly connectionStartHandle: Handle | null;
  readonly connectionEndHandle: Handle | null;
  readonly connectionStatus: string | null;
};

export type HandleProps = HandlePropsSystem & {
  readonly class?: string;
  readonly style?: string;
  readonly onConnect?: (connections: Connection[]) => void;
  readonly onDisconnect?: (connections: Connection[]) => void;
};

export type FitViewOptions<NodeType extends Node = Node> = FitViewOptionsBase<NodeType>;

export type NodeGraph<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
};

export type OnDelete = (params: NodeGraph) => void;
export type OnEdgeCreate = (connection: Connection) => Edge | Connection | void;
export type OnBeforeDelete<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = OnBeforeDeleteBase<NodeType, EdgeType>;

export type IsValidConnection<EdgeType extends Edge = Edge> = (
  edge: EdgeType | Connection,
) => boolean;
