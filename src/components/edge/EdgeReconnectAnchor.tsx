import type { JSX } from "@solidjs/web";
import { type HandleType, XYHandle, type XYPosition } from "@xyflow/system";
import { createSignal, type ParentProps } from "solid-js";

import {
  armConnectionGestureLookup,
  buildConnectionGestureParams,
} from "@/components/handle/connectionGestureLookup";
import { useEdgeId, useInternalSolidFlow } from "@/contexts";
import type { Edge } from "@/types";
import { cx, extraKeysOf } from "@/utils";

import { renderEdgeLabel } from "./EdgeLabel";

export type EdgeReconnectAnchorProps = {
  readonly type: HandleType;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly position?: XYPosition;
  readonly size?: number;
  /** Externally mark the anchor as reconnecting (hides its children), in
   * addition to the gesture-driven internal state. */
  readonly reconnecting?: boolean;
  /** Called when a reconnect gesture on this anchor starts/ends — the Solid
   * translation of Svelte Flow's `bind:reconnecting`. */
  readonly onReconnectingChange?: (reconnecting: boolean) => void;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

/**
 * The props the anchor consumes itself plus the attributes its label element
 * sets (an extra prop never overrides them); every other key is an attribute
 * of the element.
 */
const OWN_KEYS: ReadonlySet<string> = new Set([
  "type",
  "class",
  "style",
  "position",
  "size",
  "reconnecting",
  "onReconnectingChange",
  "children",
  "role",
  "tabindex",
  "onClick",
  "onPointerDown",
]);

/**
 * Grab area that lets an edge end be dragged off its handle and reconnected.
 * As in Svelte Flow it is one element, the edge label itself, carrying the
 * updater classes and size: one per anchor, typically two per custom edge.
 */
export const EdgeReconnectAnchor = (props: ParentProps<EdgeReconnectAnchorProps>): JSX.Element => {
  const { store, nodeLookup, edgeLookup, actions, commands, nodeGeometry } = useInternalSolidFlow();

  // Throws outside an edge component (as Svelte Flow's getEdgeIdContext);
  // the id itself is read where it is used, not here in the body.
  const edgeId = useEdgeId();
  const [reconnecting, setReconnecting] = createSignal(false);

  const edge = () => edgeLookup[edgeId()]!;
  const isReconnecting = () => !!props.reconnecting || reconnecting();

  const setReconnectingState = (next: boolean) => {
    setReconnecting(next);
    props.onReconnectingChange?.(next);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    // The edge as the gesture found it: every callback of this gesture gets
    // the OLD edge (Svelte Flow captures it the same way), even after the
    // reconnect write has committed.
    const oldEdge = edge();

    setReconnectingState(true);
    store.onReconnectStart?.(event, oldEdge, props.type);

    const opposite =
      props.type === "target"
        ? {
            nodeId: oldEdge.source,
            handleId: oldEdge.sourceHandle ?? null,
            type: "source" as HandleType,
          }
        : {
            nodeId: oldEdge.target,
            handleId: oldEdge.targetHandle ?? null,
            type: "target" as HandleType,
          };

    // RFC-4239 win #1: same gesture-scoped spatial view as Handle.tsx.
    const gestureLookup = armConnectionGestureLookup({
      event,
      real: nodeLookup,
      geometry: nodeGeometry,
      domNode: store.domNode,
      getTransform: () => store.transform,
      connectionRadius: store.connectionRadius,
    });
    XYHandle.onPointerDown(event, {
      ...buildConnectionGestureParams({ event, store, actions, gestureLookup }),
      nodeId: opposite.nodeId,
      handleId: opposite.handleId,
      isTarget: opposite.type === "target",
      edgeUpdaterType: opposite.type,
      onConnect: (connection) => {
        const reconnected: Edge = { ...oldEdge, ...connection };
        // `undefined` from onBeforeReconnect cancels: no write, no onReconnect.
        const newEdge = store.onBeforeReconnect
          ? store.onBeforeReconnect(reconnected, oldEdge)
          : reconnected;
        if (!newEdge) return;

        // One indexed row write, not a map over every edge.
        commands.updateEdge(oldEdge.id, () => newEdge, { replace: true });
        store.onReconnect?.(oldEdge, connection);
      },
      onReconnectEnd: (event, connectionState) => {
        setReconnectingState(false);
        store.onReconnectEnd?.(event, oldEdge, opposite.type, connectionState);
      },
    });
  };

  const size = () => props.size ?? 25;

  return renderEdgeLabel(props, extraKeysOf(props, OWN_KEYS), {
    x: () => props.position?.x ?? 0,
    y: () => props.position?.y ?? 0,
    width: size,
    height: size,
    class: () =>
      cx(
        "solid-flow__edge-label",
        "transparent",
        "solid-flow__edgeupdater",
        `solid-flow__edgeupdater-${props.type}`,
        store.noPanClass,
        props.class,
      ),
    style: () => props.style,
    selectEdgeOnClick: () => false,
    children: () => (isReconnecting() ? undefined : props.children),
    onPointerDown,
  });
};
