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
  type IsValidConnection as SystemIsValidConnection,
  type Optional,
  XYHandle,
} from "@xyflow/system";
import { createEffect, omit, type ParentProps } from "solid-js";
import { snapshot } from "solid-js";

import {
  armConnectionGestureLookup,
  buildConnectionGestureParams,
} from "@/components/handle/connectionGestureLookup";
import { useInternalSolidFlow, useNodeId } from "@/contexts";
import { useNodeConnectable } from "@/contexts/nodeConnectable";
import { connectionKey } from "@/core";
import type { Edge, Node, Position } from "@/types";
import { propDefaults } from "@/utils";
import { getEdgeId } from "@/utils";

type HandleProps = Omit<SystemHandleProps, "position"> & {
  readonly position: Position;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly onConnect?: (connections: Connection[]) => void;
  readonly onDisconnect?: (connections: Connection[]) => void;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

/** Connection point on a node; place inside custom nodes to make them connectable. */
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

  // KEYED subscriptions only (perf P2): a handle re-runs when ITS entries
  // flip, never on every-gesture or every-move connection state. The
  // possible-target affordance (formerly the per-handle connectionindicator
  // computation, ~490ms at gesture start @10k) is now ROOT classes + CSS.
  const originState = () =>
    store.connectionOriginByHandle[connectionKey(nodeId(), _props.type, handleId())];
  const connectingFrom = () => originState() === "from";

  // Keyed subscription: this handle re-runs only when ITS entry flips, not
  // on every hover-target change anywhere in the graph.
  const targetState = () =>
    store.connectionTargetByHandle[connectionKey(nodeId(), _props.type, handleId())];
  const connectingTo = () => targetState() !== undefined;

  const valid = () => targetState() === "valid";

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
    // RFC-4239 win #1: XYHandle's closest-handle search iterates this lookup
    // on EVERY pointermove — hand it a gesture-scoped spatial view instead.
    const gestureLookup = armConnectionGestureLookup({
      event,
      real: nodeLookup,
      domNode: store.domNode,
      getTransform: () => store.transform,
      connectionRadius: store.connectionRadius,
    });
    XYHandle.onPointerDown(event, {
      ...buildConnectionGestureParams({ event, store, actions, gestureLookup }),
      handleId: handleId(),
      nodeId: nodeId(),
      isTarget: isTarget(),
      // Per-handle validation override is this call site's genuine delta.
      isValidConnection: (_props.isValidConnection ??
        store.isValidConnection) as SystemIsValidConnection,
      onConnect: onConnectExtended,
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
          // Loose-mode target exclusion: the origin node's same-id handles.
          excluded: !!originState(),
        },
      ]}
    >
      {_props.children}
    </div>
  );
};
