import { For } from "solid-js";

import type { DefaultEdgeOptions, Edge, EdgeEvents, Node } from "@/types";

import { useInternalSolidFlow } from "../contexts";
import { EdgeWrapper } from "../graph/edge";
import { MarkerDefinition } from "../graph/marker";

type EdgeRendererProps<EdgeType extends Edge = Edge> = EdgeEvents<EdgeType> & {
  readonly defaultEdgeOptions?: DefaultEdgeOptions;
  readonly reconnectRadius: number;
};

export const EdgeRenderer = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeRendererProps<EdgeType>,
) => {
  const { store } = useInternalSolidFlow();
  return (
    <div class="solid-flow__edges">
      <svg class="solid-flow__marker">
        <MarkerDefinition />
      </svg>

      <For each={store.visibleEdgeIds}>
        {(edgeId) => {
          return (
            <EdgeWrapper<NodeType, EdgeType>
              edgeId={edgeId}
              onEdgeClick={props.onEdgeClick}
              onEdgeContextMenu={props.onEdgeContextMenu}
              onEdgePointerEnter={props.onEdgePointerEnter}
              onEdgePointerLeave={props.onEdgePointerLeave}
            />
          );
        }}
      </For>
    </div>
  );
};
