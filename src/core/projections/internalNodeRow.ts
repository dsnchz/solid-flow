import {
  clampPosition,
  clampPositionToParent,
  type CoordinateExtent,
  getNodeDimensions,
  getNodePositionWithOrigin,
  isCoordinateExtent,
  isNumeric,
  type NodeBase,
  type NodeHandleBounds,
  type NodeOrigin,
  type XYPosition,
  type ZIndexMode,
} from "@xyflow/system";

import type { InternalNode, Node } from "@/types";

import type { NodeMeasurement } from "./internalNodes";

// The pure parts of the internalNodes row derive (audit C4): what a row
// computes from its inputs, the fresh row of the reconcile path, and the
// leaf differ of the in-place path. No tracking happens here beyond the
// reads the caller hands in (the parent row), and nothing is written except
// the row passed to writeChangedLeaves.

const SELECTED_NODE_Z = 1000;
const ROOT_PARENT_Z_INCREMENT = 10;

export function isManualZIndexMode(zIndexMode?: ZIndexMode): boolean {
  return zIndexMode === "manual";
}

export function calculateZ(
  node: Pick<Node, "zIndex" | "selected">,
  selectedNodeZ: number,
  zIndexMode?: ZIndexMode,
): number {
  const zIndex = isNumeric(node.zIndex) ? node.zIndex : 0;

  if (isManualZIndexMode(zIndexMode)) {
    return zIndex;
  }

  return zIndex + (node.selected ? selectedNodeZ : 0);
}

/** The flow settings every row reads (one value-equal memo in the caller). */
export type RowSettings = {
  readonly nodeOrigin: NodeOrigin;
  readonly nodeExtent: CoordinateExtent;
  readonly zIndexMode?: ZIndexMode;
  readonly elevateNodesOnSelect: boolean;
};

/** The row's tracked inputs besides the user snapshot, already joined. */
export type RowJoins = {
  /** Selection overlay joined with the user row. */
  readonly selected: boolean;
  /** Drag overlay joined with the user row. */
  readonly dragging: boolean;
  /** Drag overlay joined with the user row's position. */
  readonly position: XYPosition;
  readonly measurement: NodeMeasurement | undefined;
  /** The node's z block in "auto" mode when it is a root parent. */
  readonly rootParentIndex: number | undefined;
};

/** Everything a row derive computes, as plain values: what the row leaves hold. */
export type RowState = {
  readonly selected: boolean;
  readonly dragging: boolean;
  readonly positionX: number;
  readonly positionY: number;
  readonly measuredWidth: number | undefined;
  readonly measuredHeight: number | undefined;
  /** The absolute position (renderer space). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The node's dimensions as the geometry helpers resolve them. */
  readonly width: number;
  readonly height: number;
  readonly handleBounds: NodeHandleBounds | undefined;
  readonly rootParentIndex: number | undefined;
};

/** The user-row fields the geometry helpers read, plus the joined values. */
type RowGeometryInput = Pick<
  NodeBase,
  | "id"
  | "data"
  | "position"
  | "origin"
  | "extent"
  | "zIndex"
  | "selected"
  | "measured"
  | "width"
  | "height"
  | "initialWidth"
  | "initialHeight"
>;

/**
 * A row's state from its user snapshot, its joins, the flow settings, and
 * its parent's row when it links to one (the caller decides that: parents
 * come first in the array).
 */
export const computeRowState = <NodeType extends Node>(
  user: NodeType,
  joins: RowJoins,
  settings: RowSettings,
  parent: InternalNode<NodeType> | undefined,
): RowState => {
  const { nodeOrigin, nodeExtent, zIndexMode, elevateNodesOnSelect } = settings;
  const { selected, dragging, position, measurement, rootParentIndex } = joins;
  const selectedNodeZ =
    elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0;

  // The measurements root is authoritative once a DOM measurement exists
  // (the row write-through can't be relied on — it reverts on optimistic
  // stores); the user seed covers the pre-measurement window (SSR sizing,
  // persisted layouts).
  const measuredWidth = measurement?.measured.width ?? user.measured?.width;
  const measuredHeight = measurement?.measured.height ?? user.measured?.height;
  // The inputs the upstream geometry helpers read, as one small plain
  // object — not a spread of the user row per run.
  const geometry: RowGeometryInput = {
    id: user.id,
    data: user.data,
    position,
    origin: user.origin,
    extent: user.extent,
    zIndex: user.zIndex,
    selected,
    measured: { width: measuredWidth, height: measuredHeight },
    width: user.width,
    height: user.height,
    initialWidth: user.initialWidth,
    initialHeight: user.initialHeight,
  };
  const dimensions = getNodeDimensions(geometry);

  let x: number;
  let y: number;
  let z: number;
  if (parent) {
    ({ x, y, z } = calculateChildXYZ(
      geometry,
      parent,
      nodeOrigin,
      nodeExtent,
      selectedNodeZ,
      zIndexMode,
    ));
  } else {
    ({ x, y } = clampPosition(
      getNodePositionWithOrigin(geometry, nodeOrigin),
      isCoordinateExtent(user.extent) ? user.extent : nodeExtent,
      dimensions,
    ));
    z =
      calculateZ(geometry, selectedNodeZ, zIndexMode) +
      (rootParentIndex !== undefined ? rootParentIndex * ROOT_PARENT_Z_INCREMENT : 0);
  }

  return {
    selected,
    dragging,
    positionX: position.x,
    positionY: position.y,
    measuredWidth,
    measuredHeight,
    x,
    y,
    z,
    width: dimensions.width,
    height: dimensions.height,
    handleBounds: measurement?.handleBounds,
    rootParentIndex,
  };
};

/**
 * The fresh row of the reconcile path (a user change): the user snapshot
 * with the state joined in. Geometry-owned objects are the row's own
 * copies: the in-place leaf writes must never land in the user's or an
 * overlay's object.
 */
export const buildRow = <NodeType extends Node>(
  user: NodeType,
  userNode: NodeType,
  state: RowState,
): InternalNode<NodeType> =>
  ({
    ...user,
    selected: state.selected,
    position: { x: state.positionX, y: state.positionY },
    dragging: state.dragging,
    measured: { width: state.measuredWidth, height: state.measuredHeight },
    internals: {
      positionAbsolute: { x: state.x, y: state.y },
      handleBounds: state.handleBounds,
      z: state.z,
      ...(state.rootParentIndex !== undefined ? { rootParentIndex: state.rootParentIndex } : {}),
      userNode,
    },
  }) as InternalNode<NodeType>;

/**
 * The in-place path (measurement, overlay, drag, parent move): writes the
 * leaves whose value changed since the previous state and nothing else.
 * Every draft read allocates a wrapper and every draft op toggles the
 * engine's write flags, so an unchanged leaf must never touch the row.
 */
export const writeChangedLeaves = <NodeType extends Node>(
  row: InternalNode<NodeType>,
  prev: RowState,
  next: RowState,
): void => {
  if (next.selected !== prev.selected) row.selected = next.selected;
  if (next.dragging !== prev.dragging) row.dragging = next.dragging;
  if (next.positionX !== prev.positionX || next.positionY !== prev.positionY) {
    const rowPosition = row.position;
    rowPosition.x = next.positionX;
    rowPosition.y = next.positionY;
  }
  if (next.measuredWidth !== prev.measuredWidth || next.measuredHeight !== prev.measuredHeight) {
    const rowMeasured = row.measured;
    rowMeasured.width = next.measuredWidth;
    rowMeasured.height = next.measuredHeight;
  }
  const moved = next.x !== prev.x || next.y !== prev.y;
  if (
    moved ||
    next.z !== prev.z ||
    next.handleBounds !== prev.handleBounds ||
    next.rootParentIndex !== prev.rootParentIndex
  ) {
    const { internals } = row;
    if (moved) {
      const { positionAbsolute } = internals;
      positionAbsolute.x = next.x;
      positionAbsolute.y = next.y;
    }
    if (next.z !== prev.z) internals.z = next.z;
    if (next.handleBounds !== prev.handleBounds) internals.handleBounds = next.handleBounds;
    if (next.rootParentIndex !== prev.rootParentIndex) {
      if (next.rootParentIndex === undefined) delete internals.rootParentIndex;
      else internals.rootParentIndex = next.rootParentIndex;
    }
  }
};

function calculateChildXYZ<NodeType extends Node>(
  childNode: RowGeometryInput,
  parentNode: InternalNode<NodeType>,
  nodeOrigin: NodeOrigin,
  nodeExtent: CoordinateExtent,
  selectedNodeZ: number,
  zIndexMode?: ZIndexMode,
) {
  const { x: parentX, y: parentY } = parentNode.internals.positionAbsolute;
  const childDimensions = getNodeDimensions(childNode);
  const positionWithOrigin = getNodePositionWithOrigin(childNode, nodeOrigin);
  const clampedPosition = isCoordinateExtent(childNode.extent)
    ? clampPosition(positionWithOrigin, childNode.extent, childDimensions)
    : positionWithOrigin;

  let absolutePosition = clampPosition(
    { x: parentX + clampedPosition.x, y: parentY + clampedPosition.y },
    nodeExtent,
    childDimensions,
  );

  if (childNode.extent === "parent") {
    absolutePosition = clampPositionToParent(absolutePosition, childDimensions, parentNode);
  }

  const childZ = calculateZ(childNode, selectedNodeZ, zIndexMode);
  const parentZ = parentNode.internals.z ?? 0;

  return {
    x: absolutePosition.x,
    y: absolutePosition.y,
    z: parentZ >= childZ ? parentZ + 1 : childZ,
  };
}
