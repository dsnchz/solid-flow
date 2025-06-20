import type {
  BezierPathOptions,
  DefaultEdgeOptionsBase,
  EdgeBase,
  EdgePosition,
  SmoothStepPathOptions,
  StepPathOptions,
} from "@xyflow/system";
import type { JSX } from "solid-js";

import type { Node } from "./node";

type UnknownStruct = Record<string, unknown>;

/**
 * An `Edge` is the complete description with everything Svelte Flow needs to know in order to
 * render it.
 * @public
 */
export type Edge<
  EdgeData extends UnknownStruct = UnknownStruct,
  EdgeType extends string | undefined = string | undefined,
> = EdgeBase<EdgeData, EdgeType> & {
  label?: string;
  labelStyle?: JSX.CSSProperties;
  style?: JSX.CSSProperties;
  class?: string;
  focusable?: boolean;
  /**
   * The ARIA role attribute for the edge, used for accessibility.
   * @default "group"
   */
  ariaRole?: JSX.HTMLAttributes<HTMLElement>["role"];
  /**
   * General escape hatch for adding custom attributes to the edge's DOM element.
   */
  domAttributes?: Omit<
    JSX.SvgSVGAttributes<SVGGElement>,
    "id" | "style" | "class" | "role" | "aria-label"
  >;
};

/**
 * Props passed to edge components. This is the main interface that custom edge components should implement.
 */
export type EdgeProps<
  EdgeData extends UnknownStruct = UnknownStruct,
  EdgeType extends string | undefined = string | undefined,
> = Omit<Edge<EdgeData, EdgeType>, "sourceHandle" | "targetHandle"> &
  EdgePosition & {
    markerStart?: string;
    markerEnd?: string;
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
  };

/**
 * Props for built-in edge components that render the actual SVG path.
 */
export type BaseEdgeProps = {
  id?: string;
  /** SVG path of the edge */
  path: string;
  /** The x coordinate of the label */
  labelX?: number;
  /** The y coordinate of the label */
  labelY?: number;
  /** Marker at start of edge */
  markerStart?: string;
  /** Marker at end of edge */
  markerEnd?: string;
  /** CSS class for the edge */
  class?: string;
  /** Edge label */
  label?: string;
  /** Styles for the edge label */
  labelStyle?: JSX.CSSProperties;
  /** Styles for the edge path */
  style?: JSX.CSSProperties;
  /** Interaction width for edge selection */
  interactionWidth?: number;
} & JSX.SvgSVGAttributes<SVGPathElement>;

/**
 * Props for built-in edge components (these match the actual component implementations)
 */
export type BezierEdgeProps = EdgeProps<Record<string, unknown>, "default"> & {
  pathOptions?: BezierPathOptions;
};

export type StraightEdgeProps = Omit<
  EdgeProps<Record<string, unknown>, "straight">,
  "sourcePosition" | "targetPosition"
>;

export type StepEdgeProps = EdgeProps<Record<string, unknown>, "step"> & {
  pathOptions?: StepPathOptions;
};

export type SmoothStepEdgeProps = EdgeProps<Record<string, unknown>, "smoothstep"> & {
  pathOptions?: SmoothStepPathOptions;
};

/**
 * Built-in edge types with their component signatures
 */
export type BuiltInEdgeTypes = {
  default: (props: BezierEdgeProps) => JSX.Element;
  straight: (props: StraightEdgeProps) => JSX.Element;
  step: (props: StepEdgeProps) => JSX.Element;
  smoothstep: (props: SmoothStepEdgeProps) => JSX.Element;
};

/**
 * Union of all built-in edge props
 */
export type BuiltInEdge = BezierEdgeProps | StraightEdgeProps | StepEdgeProps | SmoothStepEdgeProps;

/**
 * Map of edge types to their components.
 */
export type EdgeTypes = {
  [K in string]: {
    bivarianceHack(props: EdgeProps<Record<string, unknown>, string | undefined>): JSX.Element;
  }["bivarianceHack"];
};

export type DefaultEdgeOptions = DefaultEdgeOptionsBase<Edge>;

export type EdgeLayouted<EdgeType extends Edge = Edge> = EdgeType &
  EdgePosition & {
    sourceNode?: Node;
    targetNode?: Node;
    sourceHandleId?: string | null;
    targetHandleId?: string | null;
    edge: EdgeType;
  };
