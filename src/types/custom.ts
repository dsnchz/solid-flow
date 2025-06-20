import type { ConnectionLineType as SystemConnectionLineType, Handle } from "@xyflow/system";
import type { JSX } from "solid-js";

import type { InternalNode, Node } from "./node";

export type ConnectionLineType = `${SystemConnectionLineType}`;

/**
 * If you want to render a custom component for connection lines, you can set the
 * `connectionLineComponent` prop on the [`<SolidFlow />`](/api-reference/react-flow#connection-connectionLineComponent)
 * component. The `ConnectionLineComponentProps` are passed to your custom component.
 *
 * @public
 */
export type ConnectionLineComponentProps<NodeType extends Node = Node> = {
  readonly connectionLineStyle?: string | JSX.CSSProperties;
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
