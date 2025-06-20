import type { ConnectionMode } from "@xyflow/system";
import { createMemo } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";
import {
  type EdgeLayoutAllOptions,
  getLayoutedEdges,
  getVisibleNodes,
} from "@/data/visibleElements";
import type { Edge, EdgeLayouted, Node } from "@/types";

export const useVisibleElements = <
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>() => {
  const { store, nodeLookup } = useInternalSolidFlow<NodeType, EdgeType>();

  const userNodeMap = createMemo(() => {
    const map = new Map<string, NodeType>();
    for (const node of store.nodes) {
      map.set(node.id, node);
    }
    return map;
  });

  const visibleInternalNodesMap = createMemo(() => {
    if (store.onlyRenderVisibleElements) {
      return getVisibleNodes(nodeLookup, store.transform, store.width, store.height);
    }

    return nodeLookup;
  });

  const visibleNodeIds = createMemo(() =>
    Array.from(visibleInternalNodesMap().values()).map((node) => node.id),
  );

  const visibleNodesMap = createMemo(() => {
    const nodeMap = userNodeMap();
    const visibleIds = visibleNodeIds();
    const map = new Map<string, NodeType>();
    for (const nodeId of visibleIds) {
      const node = nodeMap.get(nodeId);
      if (node) {
        map.set(nodeId, node);
      }
    }
    return map;
  });

  const previousEdges = new Map<string, EdgeLayouted<EdgeType>>();

  const visibleEdgesMap = createMemo(() => {
    const options = {
      edges: store.edges,
      defaultEdgeOptions: store.defaultEdgeOptions,
      previousEdges,
      nodeLookup,
      connectionMode: store.connectionMode as ConnectionMode,
      elevateEdgesOnSelect: store.elevateEdgesOnSelect,
      onerror: store.onError,
    };

    if (store.onlyRenderVisibleElements) {
      return getLayoutedEdges({
        ...options,
        onlyRenderVisible: true,
        visibleNodes: visibleInternalNodesMap(),
        transform: store.transform,
        width: store.width,
        height: store.height,
      });
    }

    return getLayoutedEdges(options as EdgeLayoutAllOptions<NodeType, EdgeType>);
  });

  const visibleEdgeIds = createMemo(() =>
    Array.from(visibleEdgesMap().values()).map((edge) => edge.id),
  );

  const layoutedEdgesMap = createMemo(() => {
    const edges = visibleEdgesMap();
    const map = new Map<string, EdgeLayouted<EdgeType>>();
    for (const edge of edges.values()) {
      map.set(edge.id, edge);
    }
    return map;
  });

  return {
    visibleInternalNodesMap,
    visibleNodeIds,
    visibleNodesMap,
    visibleEdgesMap,
    visibleEdgeIds,
    layoutedEdgesMap,
  } as const;
};
