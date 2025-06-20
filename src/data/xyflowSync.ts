import { adoptUserNodes, updateConnectionLookup } from "@xyflow/system";
import { batch } from "solid-js";
import { produce } from "solid-js/store";

import type { Edge, Node } from "@/types";

import type { SolidFlowStore } from "./types";

type SyncArgs<NodeType extends Node, EdgeType extends Edge> = SolidFlowStore<NodeType, EdgeType> & {
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
};

export const xyflowSync = <NodeType extends Node, EdgeType extends Edge>({
  store,
  setStore,
  nodes,
  edges,
}: SyncArgs<NodeType, EdgeType>) => {
  setStore(
    produce((store) => {
      store.nodes = nodes;
      store.edges = edges;
    }),
  );

  batch(() => {
    adoptUserNodes(store.nodes, store.nodeLookup, store.parentLookup, {
      nodeExtent: store.nodeExtent,
      nodeOrigin: store.nodeOrigin,
      elevateNodesOnSelect: store.elevateNodesOnSelect,
      checkEquality: false,
    });

    updateConnectionLookup(store.connectionLookup, store.edgeLookup, store.edges);
  });
};
