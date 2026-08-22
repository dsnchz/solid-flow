import type { JSX } from "@solidjs/web";
import { ConnectionMode, type HandleType, XYHandle, type XYPosition } from "@xyflow/system";
import { createSignal, omit, type ParentProps, Show } from "solid-js";

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
  readonly reconnecting?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

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
    "children",
  );

  const { store, nodeLookup, edgeLookup, actions } = useInternalSolidFlow();

  const edgeId = useEdgeId();
  const [reconnecting, setReconnecting] = createSignal(false);

  if (!edgeId()) {
    throw new Error("[solid-flow]: EdgeReconnectAnchor must be used within an Edge component");
  }

  const edge = () => edgeLookup[edgeId()]!;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    setReconnecting(true);
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

    XYHandle.onPointerDown(event, {
      lib: store.lib,
      flowId: store.id,
      domNode: store.domNode,
      nodeId: opposite.nodeId,
      handleId: opposite.handleId,
      autoPanOnConnect: store.autoPanOnConnect,
      connectionMode: store.connectionMode as ConnectionMode,
      connectionRadius: store.connectionRadius,
      nodeLookup,
      isTarget: opposite.type === "target",
      edgeUpdaterType: opposite.type,
      cancelConnection: actions.cancelConnection,
      panBy: actions.panBy,
      updateConnection: actions.setConnection,
      isValidConnection: store.isValidConnection,
      onConnectStart: store.onConnectStart,
      onConnectEnd: store.onConnectEnd,
      onConnect: (connection) => {
        let newEdge = { ...edge(), ...connection } as Edge;
        newEdge = store.onBeforeReconnect?.(newEdge, edge()) ?? newEdge;

        if (newEdge) {
          actions.setEdges((edges) => edges.map((e) => (e.id === edge().id ? newEdge : e)));
        }

        store.onReconnect?.(edge(), connection);
      },
      onReconnectEnd: (event, connectionState) => {
        setReconnecting(false);
        store.onReconnectEnd?.(event, edge(), opposite.type, connectionState);
      },
      getTransform: () => store.transform,
      getFromHandle: () => store.connection.fromHandle,
      autoPanSpeed: store.autoPanSpeed,
      dragThreshold: store.connectionDragThreshold,
      handleDomNode: event.currentTarget as HTMLElement,
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
        <Show when={!reconnecting()}>{_props.children}</Show>
      </div>
    </EdgeLabel>
  );
};
