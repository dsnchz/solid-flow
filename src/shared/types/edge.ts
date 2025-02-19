import type {
  BezierPathOptions,
  DefaultEdgeOptionsBase,
  EdgeBase,
  EdgePosition,
  SmoothStepPathOptions,
  StepPathOptions,
} from "@xyflow/system";
import type { Component, JSX } from "solid-js";

import type { GraphTargetContextHandler, GraphTargetHandler, MouseOrTouchEvent } from "./events";
import type { Node } from "./node";

/**
 * An `Edge` is the complete description with everything Solid Flow needs
 *to know in order to render it.
 * @public
 */
export type Edge<
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeType extends string | undefined = string | undefined,
> = EdgeBase<EdgeData, EdgeType> & {
  readonly label?: string;
  readonly labelStyle?: JSX.CSSProperties;
  readonly style?: JSX.CSSProperties;
  readonly class?: string;
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

export type EdgeTypes = Record<
  string,
  Component<
    EdgeProps & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: any;
    }
  >
>;

export type DefaultEdgeOptions = DefaultEdgeOptionsBase<Edge>;

export type EdgeLayouted = Pick<
  Edge,
  | "type"
  | "id"
  | "data"
  | "style"
  | "source"
  | "target"
  | "animated"
  | "selected"
  | "selectable"
  | "deletable"
  | "label"
  | "labelStyle"
  | "interactionWidth"
  | "markerStart"
  | "markerEnd"
  | "sourceHandle"
  | "targetHandle"
  | "ariaLabel"
  | "hidden"
  | "class"
  | "zIndex"
> &
  EdgePosition & {
    sourceNode?: Node;
    targetNode?: Node;
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
  };

export type EdgeEventHandler = (edge: Edge, event: MouseOrTouchEvent) => void;

export type EdgeEventCallbacks = {
  readonly onEdgeClick: GraphTargetHandler<Edge>;
  readonly onEdgeContextMenu: GraphTargetHandler<Edge>;
  readonly onEdgeMouseEnter: GraphTargetHandler<Edge>;
  readonly onEdgeMouseLeave: GraphTargetHandler<Edge>;
  readonly onEdgeMouseMove: GraphTargetHandler<Edge>;
  readonly onEdgeDrag: GraphTargetContextHandler<Edge>;
  readonly onEdgeDragStart: GraphTargetContextHandler<Edge>;
  readonly onEdgeDragStop: GraphTargetContextHandler<Edge>;
};
