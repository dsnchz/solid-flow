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
  type IsValidConnection as SystemIsValidConnection,
  type Optional,
  XYHandle,
} from "@xyflow/system";
import { createEffect, getOwner, type ParentProps, snapshot } from "solid-js";

import {
  armConnectionGestureLookup,
  buildConnectionGestureParams,
} from "@/components/handle/connectionGestureLookup";
import { useInternalSolidFlow, useNodeId } from "@/contexts";
import { useNodeConnectable } from "@/contexts/nodeConnectable";
import { connectionKey } from "@/core";
import type { Edge, Node, Position } from "@/types";
import { cx, extraKeysOf, getEdgeId, spreadExtras } from "@/utils";

type HandleProps = Omit<SystemHandleProps, "position"> & {
  readonly position: Position;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly onConnect?: (connections: Connection[]) => void;
  readonly onDisconnect?: (connections: Connection[]) => void;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

/**
 * The props Handle consumes itself plus the attributes it sets on its
 * element (those stay the flow's, as before: an extra prop never overrides
 * them); every other key is an attribute of the element.
 */
const OWN_KEYS: ReadonlySet<string> = new Set([
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
  "role",
  "aria-label",
  "tabindex",
  "data-handleid",
  "data-nodeid",
  "data-handlepos",
  "data-id",
  "onClick",
  "onPointerDown",
]);

/** Connection point on a node; place inside custom nodes to make them connectable. */
export const Handle = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<HandleProps>,
): JSX.Element => {
  // Skip-undefined defaults (see propDefaults) without a getter object per
  // handle, and no omit record: the element takes its extra attributes
  // through spreadExtras, so the compiler keeps a static template for the
  // handle's own attributes instead of routing them all through one spread
  // (bench round 36).
  const type = () => props.type ?? "source";
  const position = () => props.position ?? "top";
  const isConnectableStart = () => props.isConnectableStart ?? true;
  const isConnectableEnd = () => props.isConnectableEnd ?? true;
  const extraKeys = extraKeysOf(props, OWN_KEYS);
  const owner = getOwner();
  const mountElement = (el: HTMLDivElement) => spreadExtras(el, props, extraKeys, owner);

  const { store, nodeLookup, connections, actions, nodeGeometry } = useInternalSolidFlow<
    NodeType,
    EdgeType
  >();

  // Computed values
  const nodeId = useNodeId();
  const nodeConnectable = useNodeConnectable();
  const connectable = () => props.isConnectable ?? nodeConnectable();
  const isTarget = () => type() === "target";
  const handleId = () => props.id ?? null;

  // KEYED subscriptions only (perf P2): a handle re-runs when ITS entries
  // flip, never on every-gesture or every-move connection state. The
  // possible-target affordance (formerly the per-handle connectionindicator
  // computation, ~490ms at gesture start @10k) is now ROOT classes + CSS.
  const originState = () =>
    store.connectionOriginByHandle[connectionKey(nodeId(), type(), handleId())];
  const connectingFrom = () => originState() === "from";

  // Keyed subscription: this handle re-runs only when ITS entry flips, not
  // on every hover-target change anywhere in the graph.
  const targetState = () =>
    store.connectionTargetByHandle[connectionKey(nodeId(), type(), handleId())];
  const connectingTo = () => targetState() !== undefined;

  const valid = () => targetState() === "valid";

  let prevConnections: Map<string, HandleConnection> | null = null;

  // The compute snapshots this handle's connection sub-record into a Map (the
  // reads — key structure + leaves — are tracked there; leaves are immutable
  // per key, so this re-runs exactly when the connection set changes). The
  // user callbacks fire from the (untracked) apply.
  // Created only for handles that pass a callback: the effect node itself
  // costs ~5 µs per handle at mount, and the stress grid has 20,000 handles
  // with neither callback (mount profile round 30). The check is made once
  // at mount — pass the callbacks up front, as with any other listener.
  if (props.onConnect || props.onDisconnect)
    createEffect(
      () => {
        const rec = connections[connectionKey(nodeId(), type(), props.id)];
        const map = new Map<string, HandleConnection>();
        for (const key of Object.keys(rec ?? {})) map.set(key, { ...rec![key]! });
        return { connections: map };
      },
      (current) => {
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
      geometry: nodeGeometry,
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
      isValidConnection: (props.isValidConnection ??
        store.isValidConnection) as SystemIsValidConnection,
      onConnect: onConnectExtended,
    });
  };

  // Read at click time, not bound as `onClick={store.clickConnect ? onClick
  // : undefined}`: a handler expression is evaluated once when the element is
  // created (untracked), so toggling `clickConnect` after mount never reached
  // the handles already rendered. `click` is delegated, so the unconditional
  // handler adds no listener per handle.
  const onClick = (event: MouseEvent) => {
    if (!store.clickConnect) return;
    if (!nodeId() || (!store.clickConnectStartHandle && !isConnectableStart())) {
      return;
    }
    if (!store.clickConnectStartHandle) {
      store.onClickConnectStart?.(event, {
        nodeId: nodeId(),
        handleId: handleId(),
        handleType: type(),
      });
      actions.setClickConnectStartHandle({ nodeId: nodeId(), type: type(), id: handleId() });
      return;
    }

    const doc = getHostForElement(event.target);
    const isValidConnectionHandler = (props.isValidConnection ??
      store.isValidConnection) as SystemIsValidConnection;

    const { connection, isValid } = XYHandle.isValid(event, {
      handle: {
        nodeId: nodeId(),
        id: handleId(),
        type: type(),
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
      ref={mountElement}
      role="button"
      aria-label={store.ariaLabelConfig[`handle.ariaLabel`]}
      tabindex={-1}
      data-handleid={handleId()}
      data-nodeid={nodeId()}
      data-handlepos={position()}
      data-id={`${store.id}-${nodeId()}-${props.id || null}-${type()}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={props.style}
      class={cx(
        "solid-flow__handle",
        `solid-flow__handle-${position()}`,
        store.noDragClass,
        store.noPanClass,
        props.class,
        {
          valid: valid(),
          connectingto: !!connectingTo(),
          connectingfrom: !!connectingFrom(),
          source: !isTarget(),
          target: isTarget(),
          connectablestart: isConnectableStart(),
          connectableend: isConnectableEnd(),
          connectable: !!connectable(),
          // Loose-mode target exclusion: the origin node's same-id handles.
          excluded: !!originState(),
        },
      )}
    >
      {props.children}
    </div>
  );
};
