import {
  areConnectionMapsEqual,
  handleConnectionChange,
  type HandleType,
  type NodeConnection,
} from "@xyflow/system";
import { type Accessor, createEffect, createSignal, untrack, useContext } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import { NodeContext } from "@/contexts/nodeId";
import { connectionKey } from "@/core";

type UseNodeConnectionsParams = {
  id?: string;
  handleType?: HandleType;
  handleId?: string;
  /** Called with the connections that appeared (not for those present on mount). */
  onConnect?: (connections: NodeConnection[]) => void;
  /** Called with the connections that went away. */
  onDisconnect?: (connections: NodeConnection[]) => void;
};

/**
 * Hook to retrieve all edges connected to a node. Can be filtered by handle type and id.
 *
 * @public
 * @param param.id - node id - optional if called inside a custom node
 * @param param.handleType - filter by handle type 'source' or 'target'
 * @param param.handleId - filter by handle id (this is only needed if the node has multiple handles of the same type)
 * @param param.onConnect - gets called when a connection is established
 * @param param.onDisconnect - gets called when a connection is removed
 * @returns an array with connections
 */
export const useNodeConnections = (
  params: Accessor<UseNodeConnectionsParams>,
): Accessor<NodeConnection[]> => {
  const { flow } = useInternalSolidFlow();

  const ctxNodeId = () => {
    // useNodeConnections can be rendered outside of NodeWrapper, so we need to use the context directly.
    const node = useContext(NodeContext);
    return node ? node.id() : "";
  };

  const id = () => params().handleId;
  const type = () => params().handleType;
  const nodeId = () => params().id ?? ctxNodeId();

  const [connections, setConnections] = createSignal<NodeConnection[]>([]);

  // The compute snapshots the sub-record into a Map of fresh copies (key
  // structure + leaves tracked there), so it re-runs only when this handle's
  // connections change. @xyflow/system 1.0's areConnectionMapsEqual compares
  // entries by reference: the copies always differ, and the gate below only
  // skips an empty set followed by another (a replaced edge id is reported).
  let prevConnections: Map<string, NodeConnection> | undefined;

  createEffect(
    () => {
      const rec = flow.connections[connectionKey(nodeId(), type(), id())];
      const map = new Map<string, NodeConnection>();
      for (const key of Object.keys(rec ?? {})) map.set(key, { ...rec![key]! });
      return { connections: map };
    },
    ({ connections: nextConnections }) => {
      if (areConnectionMapsEqual(nextConnections, prevConnections)) return;
      if (prevConnections) {
        // Read when the change lands, as an event handler reads its props.
        const { onConnect, onDisconnect } = untrack(params);
        handleConnectionChange(prevConnections, nextConnections, onDisconnect);
        handleConnectionChange(nextConnections, prevConnections, onConnect);
      }
      prevConnections = nextConnections;
      setConnections(Array.from(nextConnections.values()));
    },
    { name: "useNodeConnections" },
  );

  return connections;
};
