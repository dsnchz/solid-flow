import { Index, Show } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import CallOnMount from "@/components/utility/CallOnMount";
import type { DefaultEdgeOptions, Edge, EdgeEventCallbacks, Node } from "@/shared/types";

import EdgeWrapper from "../graph/edge/EdgeWrapper";
import { MarkerDefinition } from "../graph/marker";

type EdgeRendererProps<EdgeType extends Edge = Edge> = Partial<EdgeEventCallbacks<EdgeType>> & {
  readonly defaultEdgeOptions?: DefaultEdgeOptions;
  readonly reconnectRadius: number;
};

const EdgeRenderer = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeRendererProps<EdgeType>,
) => {
  const { store, setStore } = useFlowStore<NodeType, EdgeType>();

  return (
    <div class="solid-flow__edges">
      <Show when={store.nodesInitialized}>
        <svg class="solid-flow__marker">
          <MarkerDefinition />
        </svg>

        <Index each={store.visibleEdges}>
          {(edge) => {
            return (
              <EdgeWrapper<NodeType, EdgeType>
                edge={edge()}
                reconnectRadius={props.reconnectRadius}
                onEdgeClick={props.onEdgeClick}
                onEdgeContextMenu={props.onEdgeContextMenu}
                onEdgeMouseEnter={props.onEdgeMouseEnter}
                onEdgeMouseLeave={props.onEdgeMouseLeave}
              />
            );
          }}
        </Index>

        <Show when={store.visibleEdges.length > 0}>
          <CallOnMount
            onMount={() => {
              setStore("edgesInitialized", true);
            }}
            onCleanup={() => {
              setStore("edgesInitialized", false);
            }}
          />
        </Show>
      </Show>
    </div>
  );
};

export default EdgeRenderer;
