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
  // A change of the observed node or handle (the lookup key) is a new
  // baseline, like the mount: no edge changed, so no callback (xyflow#6163).
  let prevConnections: Map<string, NodeConnection> | undefined;
  let prevKey: string | undefined;

  createEffect(
    () => {
      const key = connectionKey(nodeId(), type(), id());
      const rec = flow.connections[key];
      const map = new Map<string, NodeConnection>();
      for (const k of Object.keys(rec ?? {})) map.set(k, { ...rec![k]! });
      return { key, connections: map };
    },
    ({ key, connections: nextConnections }) => {
      if (key === prevKey && areConnectionMapsEqual(nextConnections, prevConnections)) return;
      if (prevConnections && key === prevKey) {
        // Read when the change lands, as an event handler reads its props.
        const { onConnect, onDisconnect } = untrack(params);
        handleConnectionChange(prevConnections, nextConnections, onDisconnect);
        handleConnectionChange(nextConnections, prevConnections, onConnect);
      }
      prevKey = key;
      prevConnections = nextConnections;
      setConnections(Array.from(nextConnections.values()));
    },
    { name: "useNodeConnections" },
  );

  return connections;
};
