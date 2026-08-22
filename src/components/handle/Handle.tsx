import type { JSX } from "@solidjs/web";
import {
  areConnectionMapsEqual,
  type Connection,
  ConnectionMode,
  type ConnectionState,
  type FinalConnectionState,
  getHostForElement,
  type HandleConnection,
  handleConnectionChange,
  type HandleProps as SystemHandleProps,
  type HandleType,
  type InternalNodeBase,
  type IsValidConnection as SystemIsValidConnection,
  type Optional,
  type UpdateConnection,
  XYHandle,
} from "@xyflow/system";
import { createEffect, flush, omit, type ParentProps } from "solid-js";
import { snapshot } from "solid-js";

import { useInternalSolidFlow, useNodeId } from "@/contexts";
import { useNodeConnectable } from "@/contexts/nodeConnectable";
import { connectionKey } from "@/core";
import type { Edge, InternalNode, Node, Position } from "@/types";
import { propDefaults } from "@/utils";
import { getEdgeId } from "@/utils";

type HandleProps = Omit<SystemHandleProps, "position"> & {
  readonly position: Position;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly onConnect?: (connections: Connection[]) => void;
  readonly onDisconnect?: (connections: Connection[]) => void;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

export const Handle = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<HandleProps>,
): JSX.Element => {
  const _props = propDefaults(props, {
    type: "source" as HandleType,
    position: "top" as Position,
    isConnectableStart: true,
    isConnectableEnd: true,
  });

  const { store, nodeLookup, connections, actions } = useInternalSolidFlow<NodeType, EdgeType>();

  const rest = omit(
    _props,
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
  );

  // Computed values
  const nodeId = useNodeId();
  const nodeConnectable = useNodeConnectable();
  const connectable = () => _props.isConnectable ?? nodeConnectable();
  const isTarget = () => _props.type === "target";
  const handleId = () => _props.id ?? null;

  const connectionInProcess = () => Boolean(store.connection.fromHandle);

  const connectingFrom = () =>
    store.connection.fromHandle &&
    store.connection.fromHandle.nodeId === nodeId() &&
    store.connection.fromHandle.type === _props.type &&
    store.connection.fromHandle.id === handleId();

  const connectingTo = () =>
    store.connection.toHandle &&
    store.connection.toHandle.nodeId === nodeId() &&
    store.connection.toHandle.type === _props.type &&
    store.connection.toHandle.id === handleId();

  const isPossibleTargetHandle = () =>
    store.connectionMode === "strict"
      ? store.connection.fromHandle?.type !== _props.type
      : nodeId() !== store.connection.fromHandle?.nodeId ||
        handleId() !== store.connection.fromHandle?.id;

  const valid = () => Boolean(connectingTo() && store.connection.isValid);

  let prevConnections: Map<string, HandleConnection> | null = null;

  // The compute snapshots this handle's connection sub-record into a Map (the
  // reads — key structure + leaves — are tracked there; leaves are immutable
  // per key, so this re-runs exactly when the connection set changes). The
  // user callbacks fire from the (untracked) apply.
  createEffect(
    () => {
      if (!_props.onConnect && !_props.onDisconnect) return null;

      const rec = connections[connectionKey(nodeId(), _props.type, _props.id)];
      const map = new Map<string, HandleConnection>();
      for (const key of Object.keys(rec ?? {})) map.set(key, { ...rec![key]! });
      return { connections: map };
    },
    (current) => {
      if (!current) return;

      const { connections: next } = current;

      if (prevConnections && !areConnectionMapsEqual(next, prevConnections)) {
        handleConnectionChange(prevConnections, next, props.onDisconnect);
        handleConnectionChange(next, prevConnections, props.onConnect);
      }

      prevConnections = next;
    },
  );

  const onConnectExtended = (connection: Connection) => {
    const handleConnection = {
      ...connection,
      id: getEdgeId(connection),
    };

    const edge = store.onBeforeConnect?.(handleConnection) ?? handleConnection;

    actions.addEdge(edge);
    store.onConnect?.(handleConnection);
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
      isValidConnection: (_props.isValidConnection ??
        store.isValidConnection) as SystemIsValidConnection,
      // XYHandle reads connection state back synchronously in the same task.
      // Single seam cast: system types the callback over InternalNodeBase.
      updateConnection: ((connection: ConnectionState<InternalNode<NodeType>>) => {
        actions.setConnection(connection);
        flush();
      }) as unknown as UpdateConnection<InternalNodeBase>,
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
    if (!nodeId() || (!store.clickConnectStartHandle && !_props.isConnectableStart)) {
      return;
    }
    if (!store.clickConnectStartHandle) {
      store.onClickConnectStart?.(event, {
        nodeId: nodeId(),
        handleId: handleId(),
        handleType: _props.type,
      });
      actions.setClickConnectStartHandle({ nodeId: nodeId(), type: _props.type, id: handleId() });
      return;
    }

    const doc = getHostForElement(event.target);
    const isValidConnectionHandler = (_props.isValidConnection ??
      store.isValidConnection) as SystemIsValidConnection;

    const { connection, isValid } = XYHandle.isValid(event, {
      handle: {
        nodeId: nodeId(),
        id: handleId(),
        type: _props.type,
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

    const connectionClone = structuredClone(snapshot(store.connection)) as Optional<
      ConnectionState,
      "inProgress"
    >;

    delete connectionClone.inProgress;

    connectionClone.toPosition = connectionClone.toHandle
      ? connectionClone.toHandle.position
      : null;

    store.onClickConnectEnd?.(event, connectionClone as FinalConnectionState);
    actions.setClickConnectStartHandle(undefined);
  };

  const connectionIndicator = () =>
    connectable() &&
    (!connectionInProcess() || isPossibleTargetHandle()) &&
    (connectionInProcess() || store.clickConnectStartHandle
      ? _props.isConnectableEnd
      : _props.isConnectableStart);

  return (
    <div
      {...rest}
      role="button"
      aria-label={store.ariaLabelConfig[`handle.ariaLabel`]}
      tabindex={-1}
      data-handleid={handleId()}
      data-nodeid={nodeId()}
      data-handlepos={_props.position}
      data-id={`${store.id}-${nodeId()}-${_props.id || null}-${_props.type}`}
      onClick={store.clickConnect ? onClick : undefined}
      onPointerDown={onPointerDown}
      style={_props.style}
      class={[
        "solid-flow__handle",
        `solid-flow__handle-${_props.position}`,
        store.noDragClass,
        store.noPanClass,
        _props.class,
        {
          valid: valid(),
          connectingto: !!connectingTo(),
          connectingfrom: !!connectingFrom(),
          source: !isTarget(),
          target: isTarget(),
          connectablestart: _props.isConnectableStart,
          connectableend: _props.isConnectableEnd,
          connectable: !!connectable(),
          connectionindicator: connectionIndicator(),
        },
      ]}
    >
      {_props.children}
    </div>
  );
};
