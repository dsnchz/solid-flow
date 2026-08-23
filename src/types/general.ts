import type { JSX } from "@solidjs/web";
import type {
  Connection,
  ConnectionLineType as SystemConnectionLineType,
  ConnectionMode as SystemConnectionMode,
  FitViewOptionsBase,
  Handle,
  OnBeforeDeleteBase,
  PanOnScrollMode as SystemPanOnScrollMode,
  Position as SystemPosition,
  ResizeControlVariant as SystemResizeControlVariant,
  SelectionMode as SystemSelectionMode,
  XYPosition,
} from "@xyflow/system";

import type { Edge } from "./edge";
import type { InternalNode, Node } from "./node";

export type Position = `${SystemPosition}`;
export type ConnectionMode = `${SystemConnectionMode}`;
export type ConnectionLineType = `${SystemConnectionLineType}`;

/**
 * If you want to render a custom component for connection lines, you can set the
 * `connectionLineComponent` prop on the [`<SolidFlow />`](/api-reference/react-flow#connection-connectionLineComponent)
 * component. The `ConnectionLineComponentProps` are passed to your custom component.
 *
 * @public
 */
export type ConnectionLineComponentProps<NodeType extends Node = Node> = {
  readonly connectionLineStyle?: JSX.CSSProperties;
  readonly connectionLineType: ConnectionLineType;
  readonly fromNode: InternalNode<NodeType>;
  readonly fromHandle: Handle;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly fromPosition: Position;
  readonly toPosition: Position;
  readonly connectionStatus: "valid" | "invalid" | null;
  readonly toNode: InternalNode<NodeType> | null;
  readonly toHandle: Handle | null;
};
export type SelectionMode = `${SystemSelectionMode}`;
export type PanOnScrollMode = `${SystemPanOnScrollMode}`;
export type ResizeControlVariant = `${SystemResizeControlVariant}`;

/** A single keyboard modifier key. */
export type ShortcutModifier = "alt" | "ctrl" | "meta" | "shift";

/** Modifier requirement for a shortcut: none (`null`/`false`), one modifier, or a list that must all be held. */
export type ShortcutModifierDefinition =
  | null // none
  | false // none
  | ShortcutModifier // one
  | (ShortcutModifier | ShortcutModifier[])[]; // all of (AND);

/** Alias of `ShortcutModifierDefinition`. */
export type KeyModifier = ShortcutModifierDefinition;
/** A key name plus an optional modifier requirement. */
export type KeyDefinitionObject = { key: string; modifier?: KeyModifier };
/** A shortcut key: a plain key name or a `KeyDefinitionObject`. */
export type KeyDefinition = string | KeyDefinitionObject;

/** Live state of an in-progress connection gesture. */
export type ConnectionData = {
  connectionPosition: XYPosition | null;
  connectionStartHandle: Handle | null;
  connectionEndHandle: Handle | null;
  connectionStatus: string | null;
};

/** Options for `fitView`: padding, zoom bounds, duration, and the node subset to fit. */
export type FitViewOptions<NodeType extends Node = Node> = FitViewOptionsBase<NodeType>;

/** Handler called after nodes and/or edges are deleted. */
export type OnDelete<NodeType extends Node = Node, EdgeType extends Edge = Edge> = (params: {
  nodes: NodeType[];
  edges: EdgeType[];
}) => void;

/** A connection together with the id of the edge it produced. */
export type EdgeConnection = Connection & {
  id: string;
};

/** Callback that gets called before a handle connection is created. */
export type OnBeforeEdgeConnect<EdgeType extends Edge = Edge> = (
  connection: EdgeConnection,
) => EdgeType | EdgeConnection | undefined;

/** Callback that gets called after a handle connection is created. */
export type OnEdgeConnect = (connection: EdgeConnection) => void;

/** Callback fired before a reconnect is applied; return the modified edge, or `undefined` to cancel. */
export type OnBeforeReconnect<EdgeType extends Edge = Edge> = (
  newEdge: EdgeType,
  oldEdge: EdgeType,
) => EdgeType | undefined;

/** Callback fired before nodes/edges are deleted; can abort or narrow the deletion. */
export type OnBeforeDelete<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = OnBeforeDeleteBase<NodeType, EdgeType>;

export type IsValidConnection<EdgeType extends Edge = Edge> = (
  edge: EdgeType | Connection,
) => boolean;

/** Handler called when the set of selected nodes and edges changes. */
export type OnSelectionChange<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = (params: { nodes: NodeType[]; edges: EdgeType[] }) => void;

/** A nodes + edges pair describing a (sub)graph. */
export type NodeGraph<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
};

/** Callback that maps a completed connection to the edge to create. */
export type OnEdgeCreate<EdgeType extends Edge = Edge> = (
  connection: Connection,
) => EdgeType | Connection;
