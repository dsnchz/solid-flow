import {
  clampPosition,
  clampPositionToParent,
  type CoordinateExtent,
  getBoundsOfRects,
  getDimensions,
  getHandleBounds,
  getNodeDimensions,
  type InternalNodeBase,
  type InternalNodeUpdate,
  isCoordinateExtent,
  type NodeBase,
  type NodeDimensionChange,
  type NodeOrigin,
  type NodePositionChange,
  nodeToRect,
  type ParentExpandChild,
  type Rect,
} from "@xyflow/system";

import type { NodeMeasurementWrite } from "~/core";

/**
 * The DOM side of the measurement pipeline (fork of @xyflow/system's
 * updateNodeInternals): reads each updated node element's dimensions and
 * handle bounds from the DOM and reports them as data — measurement writes
 * for the measurements root plus user-facing dimension/position changes —
 * instead of writing into a node lookup. The internalNodes projection turns
 * the measurement writes back into internal-node state.
 *
 * `parentExpandChildren` must be turned into changes via
 * {@link handleExpandParent} only AFTER the measurement writes have been
 * flushed, so parent geometry reflects this measuring pass.
 */
export function measureNodeInternals<NodeType extends InternalNodeBase>(
  updates: Map<string, InternalNodeUpdate>,
  nodeLookup: Map<string, NodeType>,
  domNode: HTMLElement | null,
  nodeExtent?: CoordinateExtent,
): {
  updatedInternals: boolean;
  measurementWrites: NodeMeasurementWrite[];
  changes: (NodeDimensionChange | NodePositionChange)[];
  parentExpandChildren: ParentExpandChild[];
} {
  const measurementWrites: NodeMeasurementWrite[] = [];
  const changes: (NodeDimensionChange | NodePositionChange)[] = [];
  const parentExpandChildren: ParentExpandChild[] = [];
  let updatedInternals = false;

  // NOTE: system's updateNodeInternals hardcodes this selector upstream too —
  // the extra class on Viewport.tsx is load-bearing.
  const viewportNode = domNode?.querySelector(".xyflow__viewport");

  if (!viewportNode) {
    return { updatedInternals, measurementWrites, changes, parentExpandChildren };
  }

  const style = window.getComputedStyle(viewportNode);
  const { m22: zoom } = new window.DOMMatrixReadOnly(style.transform);

  for (const update of updates.values()) {
    const node = nodeLookup.get(update.id);
    if (!node) {
      continue;
    }

    if (node.hidden) {
      measurementWrites.push({ id: node.id, hidden: true });
      updatedInternals = true;
      continue;
    }

    const dimensions = getDimensions(update.nodeElement);
    const dimensionChanged =
      node.measured.width !== dimensions.width || node.measured.height !== dimensions.height;
    const doUpdate = !!(
      dimensions.width &&
      dimensions.height &&
      (dimensionChanged || !node.internals.handleBounds || update.force)
    );

    if (doUpdate) {
      const nodeBounds = update.nodeElement.getBoundingClientRect();
      const extent = isCoordinateExtent(node.extent) ? node.extent : nodeExtent;
      let { positionAbsolute } = node.internals;

      if (node.parentId && node.extent === "parent") {
        positionAbsolute = clampPositionToParent(
          positionAbsolute,
          dimensions,
          nodeLookup.get(node.parentId)!,
        );
      } else if (extent) {
        positionAbsolute = clampPosition(positionAbsolute, extent, dimensions);
      }

      measurementWrites.push({
        id: node.id,
        measured: dimensions,
        handleBounds: {
          source: getHandleBounds("source", update.nodeElement, nodeBounds, zoom, node.id),
          target: getHandleBounds("target", update.nodeElement, nodeBounds, zoom, node.id),
        },
      });
      updatedInternals = true;

      if (dimensionChanged) {
        changes.push({
          id: node.id,
          type: "dimensions",
          dimensions,
        });

        if (node.expandParent && node.parentId) {
          parentExpandChildren.push({
            id: node.id,
            parentId: node.parentId,
            rect: nodeToRect(
              {
                ...node,
                measured: dimensions,
                internals: { ...node.internals, positionAbsolute },
              },
              // origin does not apply here: positionAbsolute is already
              // origin-adjusted by the internalNodes projection
            ),
          });
        }
      }
    }
  }

  return { updatedInternals, measurementWrites, changes, parentExpandChildren };
}

export function handleExpandParent(
  children: ParentExpandChild[],
  nodeLookup: Map<string, InternalNodeBase>,
  getChildNodes: (parentId: string) => readonly NodeBase[],
  nodeOrigin: NodeOrigin = [0, 0],
): (NodeDimensionChange | NodePositionChange)[] {
  const changes: (NodeDimensionChange | NodePositionChange)[] = [];
  const parentExpansions = new Map<string, { expandedRect: Rect; parent: InternalNodeBase }>();

  // determine the expanded rectangle the child nodes would take for each parent
  for (const child of children) {
    const parent = nodeLookup.get(child.parentId);
    if (!parent) {
      continue;
    }

    const parentRect = parentExpansions.get(child.parentId)?.expandedRect ?? nodeToRect(parent);
    const expandedRect = getBoundsOfRects(parentRect, child.rect);

    parentExpansions.set(child.parentId, { expandedRect, parent });
  }

  if (parentExpansions.size > 0) {
    parentExpansions.forEach(({ expandedRect, parent }, parentId) => {
      // determine the position & dimensions of the parent
      const positionAbsolute = parent.internals.positionAbsolute;
      const dimensions = getNodeDimensions(parent);
      const origin = parent.origin ?? nodeOrigin;

      // determine how much the parent expands in width and position
      const xChange =
        expandedRect.x < positionAbsolute.x
          ? Math.round(Math.abs(positionAbsolute.x - expandedRect.x))
          : 0;
      const yChange =
        expandedRect.y < positionAbsolute.y
          ? Math.round(Math.abs(positionAbsolute.y - expandedRect.y))
          : 0;

      const newWidth = Math.max(dimensions.width, Math.round(expandedRect.width));
      const newHeight = Math.max(dimensions.height, Math.round(expandedRect.height));

      const widthChange = (newWidth - dimensions.width) * origin[0];
      const heightChange = (newHeight - dimensions.height) * origin[1];

      // We need to correct the position of the parent node if the origin is not [0,0]
      if (xChange > 0 || yChange > 0 || widthChange || heightChange) {
        changes.push({
          id: parentId,
          type: "position",
          position: {
            x: parent.position.x - xChange + widthChange,
            y: parent.position.y - yChange + heightChange,
          },
        });

        /*
         * We move all child nodes in the oppsite direction
         * so the x,y changes of the parent do not move the children
         */
        for (const childNode of getChildNodes(parentId)) {
          if (!children.some((child) => child.id === childNode.id)) {
            changes.push({
              id: childNode.id,
              type: "position",
              position: {
                x: childNode.position.x + xChange,
                y: childNode.position.y + yChange,
              },
            });
          }
        }
      }

      // We need to correct the dimensions of the parent node if the origin is not [0,0]
      if (
        dimensions.width < expandedRect.width ||
        dimensions.height < expandedRect.height ||
        xChange ||
        yChange
      ) {
        changes.push({
          id: parentId,
          type: "dimensions",
          setAttributes: true,
          dimensions: {
            width: newWidth + (xChange ? origin[0] * xChange - widthChange : 0),
            height: newHeight + (yChange ? origin[1] * yChange - heightChange : 0),
          },
        });
      }
    });
  }

  return changes;
}
