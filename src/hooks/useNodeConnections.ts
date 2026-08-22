import { areConnectionMapsEqual, type HandleType, type NodeConnection } from "@xyflow/system";
import { type Accessor, createEffect, createSignal, useContext } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import { NodeIdContext } from "@/contexts/nodeId";
import { connectionKey } from "@/core";

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
export const useNodeConnections = (
  params: Accessor<UseNodeConnectionsParams>,
): Accessor<NodeConnection[]> => {
  const { flow } = useInternalSolidFlow();

  const ctxNodeId = () => {
    // useNodeConnections can be rendered outside of NodeWrapper, so we need to use the context directly.
    const id = useContext(NodeIdContext);
    return id ? id() : "";
  };

  const id = () => params().handleId;
  const type = () => params().handleType;
  const nodeId = () => params().id ?? ctxNodeId();

  const [connections, setConnections] = createSignal<NodeConnection[]>([]);

  // The compute snapshots the sub-record into a Map (key structure + leaves
  // tracked there); the diff gate below keeps the signal writes minimal.
  let prevConnections: Map<string, NodeConnection> | undefined;

  createEffect(
    () => {
      const rec = flow.connections[connectionKey(nodeId(), type(), id())];
      const map = new Map<string, NodeConnection>();
      for (const key of Object.keys(rec ?? {})) map.set(key, { ...rec![key]! });
      return { connections: map };
    },
    ({ connections: nextConnections }) => {
      if (!areConnectionMapsEqual(nextConnections, prevConnections)) {
        prevConnections = nextConnections;
        setConnections(Array.from(nextConnections.values()));
      }
    },
  );

  return connections;
};
