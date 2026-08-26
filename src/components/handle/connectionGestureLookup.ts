import {
  type ConnectionMode,
  type ConnectionState,
  getEventPosition,
  getHostForElement,
  type InternalNodeBase,
  type IsValidConnection as SystemIsValidConnection,
  type NodeBase,
  nodeToRect,
  pointToRendererPoint,
  type Transform,
  type UpdateConnection,
} from "@xyflow/system";
import { flush } from "solid-js";

import type { SolidFlowContextValue } from "@/contexts/flow";
import { GestureSpatialLookup } from "@/core/spatial/gestureLookup";
import type { Edge, InternalNode, Node } from "@/types";

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

/**
 * The XYHandle.onPointerDown params shared by BOTH connection entry points
 * (Handle and EdgeReconnectAnchor) — 18 of ~22 fields were duplicated and
 * had silently diverged (audit C2b). Call sites spread this and add their
 * genuine deltas (nodeId/handleId/isTarget, onConnect, reconnect callbacks,
 * per-handle isValidConnection override).
 */
export const buildConnectionGestureParams = <
  NodeType extends Node,
  EdgeType extends Edge,
>(options: {
  readonly event: PointerEvent;
  readonly store: SolidFlowContextValue<NodeType, EdgeType>["store"];
  readonly actions: SolidFlowContextValue<NodeType, EdgeType>["actions"];
  readonly gestureLookup: Map<string, InternalNode<NodeType>>;
}) => {
  const { event, store, actions, gestureLookup } = options;
  return {
    lib: store.lib,
    flowId: store.id,
    domNode: store.domNode,
    autoPanOnConnect: store.autoPanOnConnect,
    autoPanSpeed: store.autoPanSpeed,
    connectionMode: store.connectionMode as ConnectionMode,
    connectionRadius: store.connectionRadius,
    nodeLookup: gestureLookup,
    cancelConnection: actions.cancelConnection,
    panBy: actions.panBy,
    // XYHandle reads connection state back synchronously in the same task —
    // without the flush, fromHandle stays null and no drop ever matches.
    // Single seam cast: system types the callback over InternalNodeBase.
    updateConnection: ((connection: ConnectionState<InternalNode<NodeType>>) => {
      actions.setConnection(connection);
      flush();
    }) as unknown as UpdateConnection<InternalNodeBase>,
    isValidConnection: store.isValidConnection as SystemIsValidConnection,
    onConnectStart: store.onConnectStart,
    onConnectEnd: store.onConnectEnd,
    getTransform: () => store.transform,
    getFromHandle: () => store.connection.fromHandle,
    dragThreshold: store.connectionDragThreshold,
    handleDomNode: event.currentTarget as HTMLElement,
  };
};
