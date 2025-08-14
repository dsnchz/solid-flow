import { areConnectionMapsEqual, type HandleType, type NodeConnection } from "@xyflow/system";
import { type Accessor, createEffect, createSignal, useContext } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";
import { NodeIdContext } from "@/components/contexts/nodeId";

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
export const useNodeConnections = (params: Accessor<UseNodeConnectionsParams>) => {
  const { connectionLookup } = useInternalSolidFlow();

  const ctxNodeId = () => {
    // useNodeConnections can be rendered outside of NodeWrapper, so we need to use the context directly.
    const id = useContext(NodeIdContext);
    return id ? id() : "";
  };

  const id = () => params().handleId;
  const type = () => params().handleType;
  const nodeId = () => params().id ?? ctxNodeId();

  const [connections, setConnections] = createSignal<NodeConnection[]>([]);

  const lookupKey = () =>
    `${nodeId()}${type() ? (id() ? `-${type()}-${id()}` : `-${type()}`) : ""}`;

  createEffect((prevConnections: Map<string, NodeConnection> | undefined) => {
    const nextConnections = connectionLookup.get(lookupKey());

    if (!areConnectionMapsEqual(nextConnections, prevConnections)) {
      prevConnections = nextConnections;
      setConnections(Array.from(prevConnections?.values() ?? []));
    }

    return nextConnections;
  });

  return connections;
};
