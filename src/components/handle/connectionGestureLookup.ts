import {
  getEventPosition,
  getHostForElement,
  type NodeBase,
  nodeToRect,
  pointToRendererPoint,
  type Transform,
} from "@xyflow/system";

import { GestureSpatialLookup } from "@/core/spatial/gestureLookup";

/**
 * Upstream `getClosestHandle` prefilters nodes within
 * `connectionRadius + ADDITIONAL_DISTANCE` of the pointer; ADDITIONAL_DISTANCE
 * is hardcoded to 250 in @xyflow/system (xyhandle/utils.ts). Tracked here with
 * a safety pad: a superset of candidates is always correct (their exact
 * distance filter runs after), so the pad only costs a few extra candidates.
 */
const UPSTREAM_ADDITIONAL_DISTANCE = 250;
const SAFETY_PAD = 50;

/**
 * Arms a gesture-scoped spatial lookup for a connection gesture (RFC-4239
 * win #1): node geometry is frozen while a connection is dragged, so the
 * rects are snapshotted into a grid once, and a CAPTURE-phase listener on the
 * same document XYHandle listens on updates the query neighborhood from the
 * same event — before XYHandle's own handler runs its closest-handle scan.
 * The listeners remove themselves on mouseup/touchend.
 *
 * Returns the facade to hand to `XYHandle.onPointerDown` (falls back to the
 * real lookup when the container is unmeasured, mirroring XYHandle's own
 * bail-out).
 */
export const armConnectionGestureLookup = <V extends NodeBase>(options: {
  readonly event: PointerEvent;
  readonly real: Map<string, V>;
  readonly domNode: HTMLElement | null;
  readonly getTransform: () => Transform;
  readonly connectionRadius: number;
}): Map<string, V> => {
  const { event, real, domNode, getTransform, connectionRadius } = options;

  const containerBounds = domNode?.getBoundingClientRect();
  if (!containerBounds) return real;

  const radius = connectionRadius + UPSTREAM_ADDITIONAL_DISTANCE + SAFETY_PAD;
  const lookup = new GestureSpatialLookup<V>(real, radius);
  lookup.arm((node) => nodeToRect(node));

  const update = (moveEvent: MouseEvent | TouchEvent) => {
    lookup.setQueryCenter(
      pointToRendererPoint(
        getEventPosition(moveEvent, containerBounds),
        getTransform(),
        false,
        [1, 1],
      ),
      radius,
    );
  };
  update(event);

  const doc = getHostForElement(event.target);
  const dispose = () => {
    doc.removeEventListener("mousemove", update as EventListener, true);
    doc.removeEventListener("touchmove", update as EventListener, true);
    doc.removeEventListener("mouseup", dispose, true);
    doc.removeEventListener("touchend", dispose, true);
    lookup.disarm();
  };
  doc.addEventListener("mousemove", update as EventListener, true);
  doc.addEventListener("touchmove", update as EventListener, true);
  doc.addEventListener("mouseup", dispose, true);
  doc.addEventListener("touchend", dispose, true);

  return lookup;
};
