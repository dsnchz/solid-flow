/**
 * Documented re-exports of `@xyflow/system` symbols whose upstream
 * declarations carry no JSDoc. Each alias is part of Solid Flow's public API;
 * the doc comment here is the symbol documentation rendered on JSR.
 * @module
 */
import {
  type Align as SystemAlign,
  type AriaLabelConfig as SystemAriaLabelConfig,
  type BezierPathOptions as SystemBezierPathOptions,
  type Box as SystemBox,
  type ColorMode as SystemColorMode,
  type ColorModeClass as SystemColorModeClass,
  type Dimensions as SystemDimensions,
  type EdgeBase,
  type EdgeMarkerType as SystemEdgeMarkerType,
  type FitBoundsOptions as SystemFitBoundsOptions,
  getBezierEdgeCenter as systemGetBezierEdgeCenter,
  type GetBezierPathParams as SystemGetBezierPathParams,
  getEdgeCenter as systemGetEdgeCenter,
  type GetSmoothStepPathParams as SystemGetSmoothStepPathParams,
  type GetStraightPathParams as SystemGetStraightPathParams,
  type IsValidConnection as SystemIsValidConnection,
  type NodeBase,
  type OnConnect as SystemOnConnect,
  type OnConnectEnd as SystemOnConnectEnd,
  type OnConnectStart as SystemOnConnectStart,
  type OnConnectStartParams as SystemOnConnectStartParams,
  type OnError as SystemOnError,
  type OnMove,
  type OnReconnect as SystemOnReconnect,
  type OnReconnectEnd as SystemOnReconnectEnd,
  type OnReconnectStart as SystemOnReconnectStart,
  type OnResize as SystemOnResize,
  type OnResizeEnd as SystemOnResizeEnd,
  type OnResizeStart as SystemOnResizeStart,
  type OnSelectionDrag as SystemOnSelectionDrag,
  type Rect as SystemRect,
  type ResizeDragEvent as SystemResizeDragEvent,
  type ResizeParams as SystemResizeParams,
  type ResizeParamsWithDirection as SystemResizeParamsWithDirection,
  SelectionMode as SystemSelectionMode,
  type SelectionRect as SystemSelectionRect,
  type SetCenterOptions as SystemSetCenterOptions,
  type SmoothStepPathOptions as SystemSmoothStepPathOptions,
  type SnapGrid as SystemSnapGrid,
  type Transform as SystemTransform,
  type ViewportHelperFunctionOptions as SystemViewportHelperFunctionOptions,
  type XYZPosition as SystemXYZPosition,
} from "@xyflow/system";

/** Alignment of an attached element (e.g. a toolbar) along its side: 'start' | 'center' | 'end'. */
export type Align = SystemAlign;

/** Configurable UI strings and ARIA descriptions (localization / a11y overrides). */
export type AriaLabelConfig = SystemAriaLabelConfig;

/** Options controlling bezier edge path curvature. */
export type BezierPathOptions = SystemBezierPathOptions;

/** A rectangle expressed as top-left position plus bottom-right extent. */
export type Box = SystemBox;

/** Color scheme for the flow: an explicit class or 'system' (media-query resolved). */
export type ColorMode = SystemColorMode;

/** A resolved color scheme class: 'light' | 'dark'. */
export type ColorModeClass = SystemColorModeClass;

/** A width/height pair. */
export type Dimensions = SystemDimensions;

/** An edge marker reference: a marker type string or a full `EdgeMarker` config. */
export type EdgeMarkerType = SystemEdgeMarkerType;

/** Options for fitting the viewport to a set of bounds. */
export type FitBoundsOptions = SystemFitBoundsOptions;

/** Parameters accepted by `getBezierPath`. */
export type GetBezierPathParams = SystemGetBezierPathParams;

/** Parameters accepted by `getSmoothStepPath`. */
export type GetSmoothStepPathParams = SystemGetSmoothStepPathParams;

/** Parameters accepted by `getStraightPath`. */
export type GetStraightPathParams = SystemGetStraightPathParams;

/** Predicate deciding whether a pending connection may become an edge. */
export type IsValidConnection<EdgeType extends EdgeBase = EdgeBase> =
  SystemIsValidConnection<EdgeType>;

/** Handler called when a connection successfully completes. */
export type OnConnect = SystemOnConnect;

/** Handler called when a connection gesture ends (whether or not an edge was made). */
export type OnConnectEnd<NodeType extends NodeBase = NodeBase> = SystemOnConnectEnd<NodeType>;

/** Handler called when a user starts dragging a connection from a handle. */
export type OnConnectStart = SystemOnConnectStart;

/** The handle a connection gesture started from. */
export type OnConnectStartParams = SystemOnConnectStartParams;

/** Handler for internal, non-fatal flow errors (logged instead of thrown). */
export type OnError = SystemOnError;

/** Handler called when the user starts panning or zooming the viewport. */
export type OnMoveStart = OnMove;

/** Handler called when the user stops panning or zooming the viewport. */
export type OnMoveEnd = OnMove;

/** Handler called after an edge has been reconnected to a different handle. */
export type OnReconnect<EdgeType extends EdgeBase = EdgeBase> = SystemOnReconnect<EdgeType>;

/** Handler called when an edge reconnection gesture ends. */
export type OnReconnectEnd<
  NodeType extends NodeBase = NodeBase,
  EdgeType extends EdgeBase = EdgeBase,
> = SystemOnReconnectEnd<NodeType, EdgeType>;

/** Handler called when the user starts dragging an edge end off its handle. */
export type OnReconnectStart<EdgeType extends EdgeBase = EdgeBase> =
  SystemOnReconnectStart<EdgeType>;

/** Handler called while a node is being resized. */
export type OnResize = SystemOnResize;

/** Handler called when a node resize gesture ends. */
export type OnResizeEnd = SystemOnResizeEnd;

/** Handler called when a node resize gesture starts. */
export type OnResizeStart = SystemOnResizeStart;

/** Handler called while a selection of nodes is dragged. */
export type OnSelectionDrag<NodeType extends NodeBase = NodeBase> = SystemOnSelectionDrag<NodeType>;

/** Pro/attribution options (`hideAttribution`). */
/**
 * Attribution options (formerly exported by @xyflow/system; the export was
 * removed in 0.0.81, so the shape lives here now — upstream parity).
 * If you hide the attribution, please support the xyflow project.
 */
export type ProOptions = {
  account?: string;
  /** If you hide the attribution, please support the xyflow project. */
  hideAttribution: boolean;
};

/** A rectangle: position plus dimensions. */
export type Rect = SystemRect;

/** The drag event delivered to resize handlers. */
export type ResizeDragEvent = SystemResizeDragEvent;

/** Geometry of a resize step: position and dimensions. */
export type ResizeParams = SystemResizeParams;

/** Resize geometry plus the direction of the drag. */
export type ResizeParamsWithDirection = SystemResizeParamsWithDirection;

/** The user-drawn selection rectangle in flow coordinates. */
export type SelectionRect = SystemSelectionRect;

/** Options for `setCenter`: zoom and transition behavior. */
export type SetCenterOptions = SystemSetCenterOptions;

/** Options controlling smooth-step edge path geometry. */
export type SmoothStepPathOptions = SystemSmoothStepPathOptions;

/** Grid nodes snap to while dragging: `[x, y]` step sizes. */
export type SnapGrid = SystemSnapGrid;

/** The viewport transform as `[translateX, translateY, zoom]`. */
export type Transform = SystemTransform;

/** Common options for viewport helper functions (e.g. transition duration). */
export type ViewportHelperFunctionOptions = SystemViewportHelperFunctionOptions;

/** An x/y position with a z-index. */
export type XYZPosition = SystemXYZPosition;

/**
 * How drag-selection decides membership: 'full' requires nodes to be fully
 * inside the selection box, 'partial' selects on any overlap.
 */
export const SelectionMode: typeof SystemSelectionMode = SystemSelectionMode;

/** See {@link SelectionMode}. */
export type SelectionMode = SystemSelectionMode;

/** Returns the center `[x, y]` of a straight edge between two points. */
export const getEdgeCenter: typeof systemGetEdgeCenter = systemGetEdgeCenter;

/** Returns the label center and offsets for a bezier edge. */
export const getBezierEdgeCenter: typeof systemGetBezierEdgeCenter = systemGetBezierEdgeCenter;
