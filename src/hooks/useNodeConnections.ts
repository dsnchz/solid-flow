import { areConnectionMapsEqual, type HandleType, type NodeConnection } from "@xyflow/system";
import { createEffect, createSignal } from "solid-js";

import { useFlowStore, useNodeId } from "@/components/contexts";

type UseNodeConnectionsParams = {
  id?: string;
  handleType?: HandleType;
  handleId?: string;
  // TODO: Svelte 5
  //   onConnect?: (connections: Connection[]) => void;
  //   onDisconnect?: (connections: Connection[]) => void;
};

/**
 * Hook to retrieve all edges connected to a node. Can be filtered by handle type and id.
 *
 * @public
 * @param param.id - node id - optional if called inside a custom node
 * @param param.handleType - filter by handle type 'source' or 'target'
 * @param param.handleId - filter by handle id (this is only needed if the node has multiple handles of the same type)
 * @todo @param param.onConnect - gets called when a connection is established
 * @todo @param param.onDisconnect - gets called when a connection is removed
 * @returns an array with connections
 */
export function useNodeConnections({ id, handleType, handleId }: UseNodeConnectionsParams = {}) {
  const { store } = useFlowStore();
  const contextNodeId = useNodeId();
  const [connections, setConnections] = createSignal<NodeConnection[]>([]);

  const nodeId = () => id ?? contextNodeId();

  let prevConnections: Map<string, NodeConnection> | undefined = undefined;

  const lookupKey = () =>
    `${nodeId()}${handleType ? (handleId ? `-${handleType}-${handleId}` : `-${handleType}`) : ""}`;

  createEffect(() => {
    const nextConnections = store.connectionLookup.get(lookupKey());

    if (!areConnectionMapsEqual(nextConnections, prevConnections)) {
      prevConnections = nextConnections;
      setConnections(Array.from(prevConnections?.values() ?? []));
    }
  });

  return connections;
}
