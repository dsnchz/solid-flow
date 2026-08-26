import type { JSX } from "@solidjs/web";
import { type HandleType, XYHandle, type XYPosition } from "@xyflow/system";
import { createSignal, omit, type ParentProps, Show } from "solid-js";

import {
  armConnectionGestureLookup,
  buildConnectionGestureParams,
} from "@/components/handle/connectionGestureLookup";
import { useEdgeId, useInternalSolidFlow } from "@/contexts";
import type { Edge } from "@/types";
import { propDefaults, toPxString } from "@/utils";

import { EdgeLabel } from "./EdgeLabel";

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

/** Grab area that lets an edge end be dragged off its handle and reconnected. */
export const EdgeReconnectAnchor = (props: ParentProps<EdgeReconnectAnchorProps>): JSX.Element => {
  const _props = propDefaults(props, {
    size: 25,
    reconnecting: false,
    style: {} as JSX.CSSProperties,
  });

  const rest = omit(
    _props,
    "type",
    "class",
    "style",
    "position",
    "size",
    "reconnecting",
    "onReconnectingChange",
    "children",
  );

  const { store, nodeLookup, edgeLookup, actions } = useInternalSolidFlow();

  const edgeId = useEdgeId();
  const [reconnecting, setReconnecting] = createSignal(false);

  if (!edgeId()) {
    throw new Error("[solid-flow]: EdgeReconnectAnchor must be used within an Edge component");
  }

  const edge = () => edgeLookup[edgeId()]!;
  const isReconnecting = () => _props.reconnecting || reconnecting();

  const setReconnectingState = (next: boolean) => {
    setReconnecting(next);
    _props.onReconnectingChange?.(next);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    setReconnectingState(true);
    store.onReconnectStart?.(event, edge(), _props.type);

    const opposite =
      _props.type === "target"
        ? {
            nodeId: edge().source,
            handleId: edge().sourceHandle ?? null,
            type: "source" as HandleType,
          }
        : {
            nodeId: edge().target,
            handleId: edge().targetHandle ?? null,
            type: "target" as HandleType,
          };

    // RFC-4239 win #1: same gesture-scoped spatial view as Handle.tsx.
    const gestureLookup = armConnectionGestureLookup({
      event,
      real: nodeLookup,
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
        let newEdge = { ...edge(), ...connection } as Edge;
        newEdge = store.onBeforeReconnect?.(newEdge, edge()) ?? newEdge;

        if (newEdge) {
          actions.setEdges((edges) => edges.map((e) => (e.id === edge().id ? newEdge : e)));
        }

        store.onReconnect?.(edge(), connection);
      },
      onReconnectEnd: (event, connectionState) => {
        setReconnectingState(false);
        store.onReconnectEnd?.(event, edge(), opposite.type, connectionState);
      },
    });
  };

  return (
    <EdgeLabel x={_props.position?.x} y={_props.position?.y} style={_props.style} {...rest}>
      <div
        onPointerDown={onPointerDown}
        class={[
          "solid-flow__edgeupdater",
          `solid-flow__edgeupdater-${_props.type}`,
          store.noPanClass,
          _props.class,
        ]}
        style={{
          width: toPxString(_props.size),
          height: toPxString(_props.size),
          background: "transparent",
          border: "none",
          cursor: "move",
          ..._props.style,
        }}
      >
        <Show when={!isReconnecting()}>{_props.children}</Show>
      </div>
    </EdgeLabel>
  );
};
