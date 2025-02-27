import {
  areConnectionMapsEqual,
  type HandleConnection,
  handleConnectionChange,
  isMouseEvent,
  XYHandle,
} from "@xyflow/system";
import clsx from "clsx";
import { createContext, createEffect, type ParentComponent, useContext } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import type { HandleProps } from "@/shared/types";

export const HandleContext = createContext<string>();

const Handle: ParentComponent<HandleProps> = (props) => {
  const nodeId = useContext(HandleContext);
  const { store, updateConnection, cancelConnection, panBy, addEdge } = useFlowStore();

  // Computed values
  const isTarget = () => props.type === "target";
  const handleId = () => props.id || null;

  const onPointerDown = (event: MouseEvent | TouchEvent) => {
    const isMouseTriggered = isMouseEvent(event);

    if ((isMouseTriggered && event.button === 0) || !isMouseTriggered) {
      XYHandle.onPointerDown(event, {
        handleId: handleId(),
        nodeId: nodeId ?? "",
        isTarget: isTarget(),
        connectionRadius: store.connectionRadius,
        domNode: store.domNode,
        nodeLookup: store.nodeLookup,
        connectionMode: store.connectionMode,
        lib: store.lib,
        autoPanOnConnect: store.autoPanOnConnect,
        flowId: store.id,
        isValidConnection: props.isValidConnection ?? store.isValidConnection,
        updateConnection,
        cancelConnection,
        panBy,
        onConnect: (connection) => {
          const edge = store.onEdgeCreate ? store.onEdgeCreate(connection) : connection;

          if (!edge) {
            return;
          }

          addEdge(edge);
          store.onConnect?.(connection);
        },
        onConnectStart: (event, startParams) => {
          store.onConnectStart?.(event, {
            nodeId: startParams.nodeId,
            handleId: startParams.handleId,
            handleType: startParams.handleType,
          });
        },
        onConnectEnd: (event, connectionState) => {
          store.onConnectEnd?.(event, connectionState);
        },
        getTransform: () => [store.viewport.x, store.viewport.y, store.viewport.zoom],
        getFromHandle: () => store.connection.fromHandle,
      });
    }
  };

  let prevConnections: Map<string, HandleConnection> | null = null;
  let connections: Map<string, HandleConnection> | undefined;

  createEffect(() => {
    if (props.onConnect || props.onDisconnect) {
      // store.edges();
      connections = store.connectionLookup.get(
        `${nodeId}-${props.type}${props.id ? `-${props.id}` : ""}`,
      );
    }

    if (prevConnections && !areConnectionMapsEqual(connections, prevConnections)) {
      const _connections = connections ?? new Map();

      handleConnectionChange(prevConnections, _connections, props.onDisconnect);
      handleConnectionChange(_connections, prevConnections, props.onConnect);
    }

    prevConnections = connections ?? new Map();
  });

  const connectionInProcess = () => !!store.connection.fromHandle;
  const connectingFrom = () =>
    store.connection.fromHandle?.nodeId === nodeId &&
    store.connection.fromHandle?.type === props.type &&
    store.connection.fromHandle?.id === handleId();

  const connectingTo = () =>
    store.connection.toHandle?.nodeId === nodeId &&
    store.connection.toHandle?.type === props.type &&
    store.connection.toHandle?.id === handleId();

  const isPossibleEndHandle = () =>
    store.connectionMode === "strict"
      ? store.connection.fromHandle?.type !== props.type
      : nodeId !== store.connection.fromHandle?.nodeId ||
        handleId() !== store.connection.fromHandle?.id;

  const valid = () => Boolean(connectingTo() && store.connection.isValid);

  return (
    <div
      data-handleid={handleId()}
      data-nodeid={nodeId}
      data-handlepos={props.position}
      data-id={`${store.id}-${nodeId}-${props.id || null}-${props.type}`}
      role="button"
      tabIndex={-1}
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
      style={props.style}
      class={clsx(
        "solid-flow__handle",
        "nodrag",
        "nopan",
        props.position,
        {
          valid: valid(),
          connectingto: connectingTo(),
          connectingfrom: connectingFrom(),
          source: !isTarget(),
          target: isTarget(),
          connectablestart: props.isConnectable,
          connectableend: props.isConnectable,
          connectable: props.isConnectable,
          connectionindicator:
            props.isConnectable && (!connectionInProcess() || isPossibleEndHandle()),
        },
        props.class,
      )}
    >
      {props.children}
    </div>
  );
};

export default Handle;
