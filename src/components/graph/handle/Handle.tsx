import {
  areConnectionMapsEqual,
  type Connection,
  ConnectionMode,
  type ConnectionState,
  getHostForElement,
  type HandleConnection,
  handleConnectionChange,
  type HandleProps as SystemHandleProps,
  type HandleType,
  type InternalNodeBase,
  type Optional,
  type UpdateConnection,
  XYHandle,
} from "@xyflow/system";
import clsx from "clsx";
import { createEffect, type JSX, mergeProps, type ParentProps, splitProps } from "solid-js";
import { unwrap } from "solid-js/store";

import { useInternalSolidFlow, useNodeId } from "@/components/contexts";
import { useNodeConnectable } from "@/components/contexts/nodeConnectable";
import type { Edge, Node, Position } from "@/types";

type HandleProps = Omit<SystemHandleProps, "position"> & {
  readonly position: Position;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly onConnect?: (connections: Connection[]) => void;
  readonly onDisconnect?: (connections: Connection[]) => void;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

export const Handle = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<HandleProps>,
) => {
  const _props = mergeProps(
    {
      id: null,
      type: "source" as HandleType,
      position: "top" as Position,
      isConnectableStart: true,
      isConnectableEnd: true,
    },
    props,
  );

  const { store, nodeLookup, connectionLookup, actions } = useInternalSolidFlow<
    NodeType,
    EdgeType
  >();

  const [local, rest] = splitProps(_props, [
    "id",
    "type",
    "position",
    "isConnectable",
    "isConnectableStart",
    "isConnectableEnd",
    "isValidConnection",
    "onConnect",
    "onDisconnect",
    "children",
    "class",
    "style",
  ]);

  // Computed values
  const nodeId = useNodeId();
  const nodeConnectable = useNodeConnectable();
  const connectable = () => local.isConnectable ?? nodeConnectable();
  const isTarget = () => local.type === "target";
  const handleId = () => local.id ?? null;

  const connectionInProcess = () => Boolean(store.connection.fromHandle);

  const connectingFrom = () =>
    store.connection.fromHandle &&
    store.connection.fromHandle.nodeId === nodeId() &&
    store.connection.fromHandle.type === local.type &&
    store.connection.fromHandle.id === handleId();

  const connectingTo = () =>
    store.connection.toHandle &&
    store.connection.toHandle.nodeId === nodeId() &&
    store.connection.toHandle.type === local.type &&
    store.connection.toHandle.id === handleId();

  const isPossibleTargetHandle = () =>
    store.connectionMode === "strict"
      ? store.connection.fromHandle?.type !== local.type
      : nodeId() !== store.connection.fromHandle?.nodeId ||
        handleId() !== store.connection.fromHandle?.id;

  const valid = () => Boolean(connectingTo() && store.connection.isValid);

  let prevConnections: Map<string, HandleConnection> | null = null;
  let connections: Map<string, HandleConnection> | undefined;

  createEffect(() => {
    if (!local.onConnect && !local.onDisconnect) return;

    const conectionKey = `${nodeId()}-${local.type}${local.id ? `-${local.id}` : ""}`;
    connections = connectionLookup.get(conectionKey);

    if (prevConnections && !areConnectionMapsEqual(connections, prevConnections)) {
      const _connections = connections ?? new Map();

      handleConnectionChange(prevConnections, _connections, props.onDisconnect);
      handleConnectionChange(_connections, prevConnections, props.onConnect);
    }

    prevConnections = connections ?? new Map();
  });

  const onConnectExtended = (connection: Connection) => {
    const edge = store.onBeforeConnect?.(connection) ?? connection;

    if (!edge) return;

    actions.addEdge(edge);
    store.onConnect?.(connection);
  };

  const onPointerDown = (event: PointerEvent) => {
    XYHandle.onPointerDown(event, {
      handleId: handleId(),
      nodeId: nodeId(),
      isTarget: isTarget(),
      connectionRadius: store.connectionRadius,
      domNode: store.domNode,
      nodeLookup,
      connectionMode: store.connectionMode as ConnectionMode,
      lib: store.lib,
      autoPanOnConnect: store.autoPanOnConnect,
      flowId: store.id,
      isValidConnection: local.isValidConnection ?? store.isValidConnection,
      updateConnection: actions.setConnection as UpdateConnection<InternalNodeBase>,
      cancelConnection: actions.cancelConnection,
      panBy: actions.panBy,
      onConnect: onConnectExtended,
      onConnectStart: (event, startParams) => {
        store.onConnectStart?.(event, {
          nodeId: startParams.nodeId,
          handleId: startParams.handleId,
          handleType: startParams.handleType,
        });
      },
      onConnectEnd: store.onConnectEnd,
      getTransform: () => store.transform,
      getFromHandle: () => store.connection.fromHandle,
      autoPanSpeed: store.autoPanSpeed,
      dragThreshold: store.connectionDragThreshold,
      handleDomNode: event.currentTarget as HTMLElement,
    });
  };

  const onClick = (event: MouseEvent) => {
    if (!nodeId() || (!store.clickConnectStartHandle && !local.isConnectableStart)) {
      return;
    }
    if (!store.clickConnectStartHandle) {
      store.onClickConnectStart?.(event, {
        nodeId: nodeId(),
        handleId: handleId(),
        handleType: local.type,
      });
      actions.setClickConnectStartHandle({ nodeId: nodeId(), type: local.type, id: handleId() });
      return;
    }

    const doc = getHostForElement(event.target);
    const isValidConnectionHandler = local.isValidConnection ?? store.isValidConnection;

    const { connection, isValid } = XYHandle.isValid(event, {
      handle: {
        nodeId: nodeId(),
        id: handleId(),
        type: local.type,
      },
      connectionMode: store.connectionMode as ConnectionMode,
      fromNodeId: store.clickConnectStartHandle.nodeId,
      fromHandleId: store.clickConnectStartHandle.id ?? null,
      fromType: store.clickConnectStartHandle.type,
      isValidConnection: isValidConnectionHandler,
      flowId: store.id,
      doc,
      lib: store.lib,
      nodeLookup,
    });

    if (isValid && connection) {
      onConnectExtended(connection);
    }

    const connectionClone = structuredClone(unwrap(store.connection)) as Optional<
      ConnectionState,
      "inProgress"
    >;

    delete connectionClone.inProgress;

    connectionClone.toPosition = connectionClone.toHandle
      ? connectionClone.toHandle.position
      : null;

    store.onClickConnectEnd?.(event, connectionClone);
    actions.setClickConnectStartHandle(undefined);
  };

  const connectionIndicator = () =>
    connectable() &&
    (!connectionInProcess() || isPossibleTargetHandle()) &&
    (connectionInProcess() || store.clickConnectStartHandle
      ? local.isConnectableEnd
      : local.isConnectableStart);

  return (
    <div
      role="button"
      aria-label={store.ariaLabelConfig[`handle.ariaLabel`]}
      tabIndex={-1}
      data-handleid={handleId()}
      data-nodeid={nodeId()}
      data-handlepos={local.position}
      data-id={`${store.id}-${nodeId()}-${local.id || null}-${local.type}`}
      onClick={store.clickConnect ? onClick : undefined}
      onPointerDown={onPointerDown}
      style={local.style}
      class={clsx(
        "solid-flow__handle",
        `solid-flow__handle-${local.position}`,
        store.noDragClass,
        store.noPanClass,
        local.class,
        {
          valid: valid(),
          connectingto: connectingTo(),
          connectingfrom: connectingFrom(),
          source: !isTarget(),
          target: isTarget(),
          connectablestart: _props.isConnectableStart,
          connectableend: _props.isConnectableEnd,
          connectable: connectable(),
          connectionindicator: connectionIndicator(),
        },
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
};
