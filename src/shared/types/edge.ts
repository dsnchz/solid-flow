import type {
  BezierPathOptions,
  Connection,
  DefaultEdgeOptionsBase,
  EdgeBase as SystemEdge,
  EdgePosition,
  FinalConnectionState,
  Handle,
  HandleType,
  Position,
  SmoothStepPathOptions,
  StepPathOptions,
} from "@xyflow/system";
import type { Component, JSX } from "solid-js";

import type { InternalNode, Node } from "@/types";

import type { GraphTargetContextHandler, GraphTargetHandler, MouseOrTouchEvent } from "./events";
import type { ConnectionLineType } from "./general";

/**
 * An `Edge` is the complete description with everything Solid Flow needs
 *to know in order to render it.
 * @public
 */
export type Edge<
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeType extends string | undefined = string | undefined,
> = SystemEdge<EdgeData, EdgeType> & {
  readonly label?: string;
  readonly labelStyle?: JSX.CSSProperties;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly reconnectable?: boolean | HandleType;
  readonly focusable?: boolean;
};

type SmoothStepEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> = Edge<
  EdgeData,
  "smoothstep"
> & {
  readonly pathOptions?: SmoothStepPathOptions;
};

type BezierEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> = Edge<
  EdgeData,
  "default"
> & {
  readonly pathOptions?: BezierPathOptions;
};

type StepEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> = Edge<
  EdgeData,
  "step"
> & {
  readonly pathOptions?: StepPathOptions;
};

type StraightEdge<EdgeData extends Record<string, unknown> = Record<string, unknown>> = Edge<
  EdgeData,
  "straight"
>;

export type BuiltInEdge = SmoothStepEdge | BezierEdge | StepEdge | StraightEdge;

/**
 * Custom edge component props.
 */
export type EdgeProps<EdgeType extends Edge = Edge> = Omit<
  EdgeType,
  "sourceHandle" | "targetHandle"
> &
  EdgePosition & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly data?: any;
    readonly type: string;
    readonly markerStart?: string;
    readonly markerEnd?: string;
    readonly sourceHandleId?: string | null;
    readonly targetHandleId?: string | null;
  };

/**
 * Helper type for edge components that get exported by the library.
 */
export type EdgeComponentProps = EdgePosition & {
  readonly id?: EdgeProps["id"];
  readonly hidden?: EdgeProps["hidden"];
  readonly deletable?: EdgeProps["deletable"];
  readonly selectable?: EdgeProps["selectable"];
  readonly markerStart?: EdgeProps["markerStart"];
  readonly markerEnd?: EdgeProps["markerEnd"];
  readonly zIndex?: EdgeProps["zIndex"];
  readonly ariaLabel?: EdgeProps["ariaLabel"];
  readonly interactionWidth?: EdgeProps["interactionWidth"];
  readonly label?: EdgeProps["label"];
  readonly labelStyle?: EdgeProps["labelStyle"];
  readonly style?: EdgeProps["style"];
  readonly class?: EdgeProps["class"];
};

export type EdgeComponentWithPathOptions<PathOptions> = EdgeComponentProps & {
  readonly pathOptions?: PathOptions;
};

/**
 * BezierEdge component props
 */
export type BezierEdgeProps = EdgeComponentWithPathOptions<BezierPathOptions>;

/**
 * SmoothStepEdge component props
 */
export type SmoothStepEdgeProps = EdgeComponentWithPathOptions<SmoothStepPathOptions>;

/**
 * StepEdge component props
 */
export type StepEdgeProps = EdgeComponentWithPathOptions<StepPathOptions>;

/**
 * StraightEdge component props
 */
export type StraightEdgeProps = Omit<EdgeComponentProps, "sourcePosition" | "targetPosition">;

export type EdgeTypes = Record<string, (props: EdgeProps) => JSX.Element>;

export type DefaultEdgeOptions = DefaultEdgeOptionsBase<Edge>;

export type EdgeLayouted<EdgeType extends Edge = Edge> = EdgeType &
  EdgePosition & {
    readonly sourceNode?: Node;
    readonly targetNode?: Node;
    readonly sourceHandleId?: string | null;
    readonly targetHandleId?: string | null;
    readonly edge: EdgeType;
  };

export type EdgeEventHandler = (edge: Edge, event: MouseOrTouchEvent) => void;

export type EdgeEventCallbacks<EdgeType extends Edge = Edge> = EdgeClickEvents<EdgeType> &
  EdgeMouseEvents<EdgeType> &
  EdgeDragEvents<EdgeType> &
  EdgeConnectionEvents<EdgeType>;

export type EdgeClickEvents<EdgeType extends Edge = Edge> = {
  readonly onEdgeClick: GraphTargetHandler<EdgeType>;
  readonly onEdgeContextMenu: GraphTargetHandler<EdgeType>;
};

export type EdgeMouseEvents<EdgeType extends Edge = Edge> = {
  readonly onEdgeMouseEnter: GraphTargetHandler<EdgeType>;
  readonly onEdgeMouseLeave: GraphTargetHandler<EdgeType>;
  readonly onEdgeMouseMove: GraphTargetHandler<EdgeType>;
};

export type EdgeDragEvents<EdgeType extends Edge = Edge> = {
  readonly onEdgeDrag: GraphTargetContextHandler<EdgeType>;
  readonly onEdgeDragStart: GraphTargetContextHandler<EdgeType>;
  readonly onEdgeDragStop: GraphTargetContextHandler<EdgeType>;
};

export type OnReconnect<EdgeType extends Edge = Edge> = (
  oldEdge: EdgeType,
  newConnection: Connection,
) => void;

export type EdgeConnectionEvents<EdgeType extends Edge = Edge> = {
  readonly onEdgeReconnect?: OnReconnect<EdgeType>;
  readonly onEdgeReconnectStart?: (
    event: MouseOrTouchEvent,
    edge: EdgeType,
    handleType: HandleType,
  ) => void;
  readonly onEdgeReconnectEnd?: (
    event: MouseOrTouchEvent,
    edge: EdgeType,
    handleType: HandleType,
    connectionState: FinalConnectionState,
  ) => void;
};

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

export type ConnectionLineComponent<NodeType extends Node = Node> = Component<
  ConnectionLineComponentProps<NodeType>
>;
