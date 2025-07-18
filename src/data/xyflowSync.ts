import { adoptUserNodes, updateConnectionLookup } from "@xyflow/system";
import { batch } from "solid-js";

import type { Edge, Node } from "@/types";

import type { SolidFlowStore } from "./types";

type SyncArgs<NodeType extends Node, EdgeType extends Edge> = SolidFlowStore<NodeType, EdgeType> & {
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
};

export const xyflowSync = <NodeType extends Node, EdgeType extends Edge>({
  store,
  actions,
  nodeLookup,
  parentLookup,
  connectionLookup,
  edgeLookup,
  nodes,
  edges,
}: SyncArgs<NodeType, EdgeType>) => {
  batch(() => {
    actions.setNodes(nodes);
    actions.setEdges(edges);
  });

  batch(() => {
    adoptUserNodes(store.nodes, nodeLookup, parentLookup, {
      nodeExtent: store.nodeExtent,
      nodeOrigin: store.nodeOrigin,
      elevateNodesOnSelect: store.elevateNodesOnSelect,
      checkEquality: false,
    });

    updateConnectionLookup(connectionLookup, edgeLookup, store.edges);
  });
};
