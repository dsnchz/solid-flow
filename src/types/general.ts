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
import type { Node } from "./node";

export type Position = `${SystemPosition}`;
export type ConnectionMode = `${SystemConnectionMode}`;
export type ConnectionLineType = `${SystemConnectionLineType}`;
export type SelectionMode = `${SystemSelectionMode}`;
export type PanOnScrollMode = `${SystemPanOnScrollMode}`;
export type ResizeControlVariant = `${SystemResizeControlVariant}`;

export type ShortcutModifier = "alt" | "ctrl" | "meta" | "shift";

export type ShortcutModifierDefinition =
  | null // none
  | false // none
  | ShortcutModifier // one
  | (ShortcutModifier | ShortcutModifier[])[]; // all of (AND);

export type KeyModifier = ShortcutModifierDefinition;
export type KeyDefinitionObject = { key: string; modifier?: KeyModifier };
export type KeyDefinition = string | KeyDefinitionObject;

export type ConnectionData = {
  connectionPosition: XYPosition | null;
  connectionStartHandle: Handle | null;
  connectionEndHandle: Handle | null;
  connectionStatus: string | null;
};

export type FitViewOptions<NodeType extends Node = Node> = FitViewOptionsBase<NodeType>;

export type OnDelete<NodeType extends Node = Node, EdgeType extends Edge = Edge> = (params: {
  nodes: NodeType[];
  edges: EdgeType[];
}) => void;

export type OnBeforeConnect<EdgeType extends Edge = Edge> = (
  connection: Connection,
) => EdgeType | Connection | undefined;

export type OnBeforeReconnect<EdgeType extends Edge = Edge> = (
  newEdge: EdgeType,
  oldEdge: EdgeType,
) => EdgeType | undefined;

export type OnBeforeDelete<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = OnBeforeDeleteBase<NodeType, EdgeType>;

export type IsValidConnection<EdgeType extends Edge = Edge> = (
  edge: EdgeType | Connection,
) => boolean;

export type OnSelectionChange<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = (params: { nodes: NodeType[]; edges: EdgeType[] }) => void;

export type NodeGraph<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
};

export type OnEdgeCreate<EdgeType extends Edge = Edge> = (
  connection: Connection,
) => EdgeType | Connection;
