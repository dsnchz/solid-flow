import {
  type Connection,
  type EdgePosition,
  type FinalConnectionState,
  type HandleType,
  type Transform,
  XYHandle,
} from "@xyflow/system";
import { Show } from "solid-js";

import { useSolidFlow } from "@/components/contexts/flow";
import type { Edge, EdgeConnectionEvents } from "@/shared/types/edge";

import { EdgeAnchor } from "./EdgeAnchor";

type EdgeUpdateAnchorsProps<EdgeType extends Edge = Edge> = EdgePosition & {
  readonly edge: EdgeType;
  readonly isReconnectable: boolean | "source" | "target";
  readonly reconnectRadius: number;
  readonly setUpdateHover: (hover: boolean) => void;
  readonly setReconnecting: (updating: boolean) => void;
} & EdgeConnectionEvents<EdgeType>;

export function EdgeUpdateAnchors<EdgeType extends Edge = Edge>(
  props: EdgeUpdateAnchorsProps<EdgeType>,
) {
  const { store, panBy, updateConnection, cancelConnection } = useSolidFlow();

  const handleEdgeUpdater = (
    event: MouseEvent,
    oppositeHandle: { nodeId: string; id: string | null; type: HandleType },
  ) => {
    // avoid triggering edge updater if mouse btn is not left
    if (event.button !== 0) {
      return;
    }

    const isTarget = oppositeHandle.type === "target";

    props.setReconnecting(true);
    props.onEdgeReconnectStart?.(event, props.edge, oppositeHandle.type);

    const _onReconnectEnd = (
      evt: MouseEvent | TouchEvent,
      connectionState: FinalConnectionState,
    ) => {
      props.setReconnecting(false);
      props.onEdgeReconnectEnd?.(evt, props.edge, oppositeHandle.type, connectionState);
    };

    const onConnectEdge = (connection: Connection) =>
      props.onEdgeReconnect?.(props.edge, connection);

    XYHandle.onPointerDown(event, {
      lib: store.lib,
      flowId: store.id,
      domNode: store.domNode,
      nodeId: oppositeHandle.nodeId,
      handleId: oppositeHandle.id,
      autoPanOnConnect: store.autoPanOnConnect,
      connectionMode: store.connectionMode,
      connectionRadius: store.connectionRadius,
      nodeLookup: store.nodeLookup,
      isTarget,
      edgeUpdaterType: oppositeHandle.type,
      cancelConnection,
      panBy,
      updateConnection,
      isValidConnection: store.isValidConnection,
      onConnect: onConnectEdge,
      onConnectStart: store.onConnectStart,
      onConnectEnd: store.onConnectEnd,
      onReconnectEnd: _onReconnectEnd,
      getTransform: () => [store.viewport.x, store.viewport.y, store.viewport.zoom] as Transform,
      getFromHandle: () => store.connection.fromHandle,
    });
  };

  const onReconnectSourceMouseDown = (event: MouseEvent): void =>
    handleEdgeUpdater(event, {
      nodeId: props.edge.target,
      id: props.edge.targetHandle ?? null,
      type: "target",
    });

  const onReconnectTargetMouseDown = (event: MouseEvent): void =>
    handleEdgeUpdater(event, {
      nodeId: props.edge.source,
      id: props.edge.sourceHandle ?? null,
      type: "source",
    });

  const onReconnectMouseEnter = () => props.setUpdateHover(true);
  const onReconnectMouseOut = () => props.setUpdateHover(false);

  return (
    <>
      <Show when={props.isReconnectable === true || props.isReconnectable === "source"}>
        <EdgeAnchor
          position={props.sourcePosition}
          centerX={props.sourceX}
          centerY={props.sourceY}
          radius={props.reconnectRadius}
          onMouseDown={onReconnectSourceMouseDown}
          onMouseEnter={onReconnectMouseEnter}
          onMouseOut={onReconnectMouseOut}
          type="source"
        />
      </Show>
      <Show when={props.isReconnectable === true || props.isReconnectable === "target"}>
        <EdgeAnchor
          position={props.targetPosition}
          centerX={props.targetX}
          centerY={props.targetY}
          radius={props.reconnectRadius}
          onMouseDown={onReconnectTargetMouseDown}
          onMouseEnter={onReconnectMouseEnter}
          onMouseOut={onReconnectMouseOut}
          type="target"
        />
      </Show>
    </>
  );
}
