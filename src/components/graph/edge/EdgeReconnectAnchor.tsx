import { ConnectionMode, type HandleType, XYHandle, type XYPosition } from "@xyflow/system";
import clsx from "clsx";
import { createSignal, type JSX, mergeProps, type ParentProps, Show, splitProps } from "solid-js";

import { useEdgeId, useInternalSolidFlow } from "@/components/contexts";
import type { Edge } from "@/types";
import { toPxString } from "@/utils";

import { EdgeLabel } from "./EdgeLabel";

export type EdgeReconnectAnchorProps = {
  readonly type: HandleType;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly position?: XYPosition;
  readonly size?: number;
  readonly reconnecting?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

export const EdgeReconnectAnchor = (props: ParentProps<EdgeReconnectAnchorProps>) => {
  const _props = mergeProps(
    {
      size: 25,
      reconnecting: false,
      style: {} as JSX.CSSProperties,
    },
    props,
  );

  const [local, rest] = splitProps(_props, [
    "type",
    "class",
    "style",
    "position",
    "size",
    "reconnecting",
    "children",
  ]);

  const {
    store,
    nodeLookup,
    edgeLookup,
    setEdges,
    panBy,
    setConnection: updateConnection,
    cancelConnection,
  } = useInternalSolidFlow();

  const edgeId = useEdgeId();
  const [reconnecting, setReconnecting] = createSignal(false);

  if (!edgeId()) {
    throw new Error("[solid-flow]: EdgeReconnectAnchor must be used within an Edge component");
  }

  const edge = () => edgeLookup.get(edgeId())!;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    setReconnecting(true);
    store.onReconnectStart?.(event, edge(), local.type);

    const opposite =
      local.type === "target"
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
      cancelConnection,
      panBy,
      updateConnection,
      isValidConnection: store.isValidConnection,
      onConnectStart: store.onConnectStart,
      onConnectEnd: store.onConnectEnd,
      onConnect: (connection) => {
        let newEdge = { ...edge(), ...connection } as Edge;
        newEdge = store.onBeforeReconnect?.(newEdge, edge()) ?? newEdge;

        if (newEdge) {
          setEdges((edges) => edges.map((e) => (e.id === edge().id ? newEdge : e)));
        }

        store.onReconnect?.(edge(), connection);
      },
      onReconnectEnd: (event, connectionState) => {
        setReconnecting(false);
        store.onReconnectEnd?.(event, edge(), opposite.type, connectionState);
      },
      getTransform: () => store.transform,
      getFromHandle: () => store.connection.fromHandle,
    });
  };

  return (
    <EdgeLabel x={local.position?.x} y={local.position?.y} style={local.style} {...rest}>
      <div
        onPointerDown={onPointerDown}
        class={clsx(
          "solid-flow__edgeupdater",
          `solid-flow__edgeupdater-${local.type}`,
          store.noPanClass,
          local.class,
        )}
        style={{
          width: toPxString(local.size),
          height: toPxString(local.size),
          background: "transparent",
          border: "none",
          cursor: "move",
          ...local.style,
        }}
      >
        <Show when={!reconnecting()}>{local.children}</Show>
      </div>
    </EdgeLabel>
  );
};
