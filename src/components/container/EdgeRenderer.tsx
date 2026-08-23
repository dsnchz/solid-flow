import type { JSX } from "@solidjs/web";
import { For } from "solid-js";

import { EdgeWrapper } from "@/components/edge";
import { MarkerDefinition } from "@/components/marker";
import { useInternalSolidFlow } from "@/contexts";
import type { DefaultEdgeOptions, Edge, EdgeEvents, Node } from "@/types";

type EdgeRendererProps<EdgeType extends Edge = Edge> = EdgeEvents<EdgeType> & {
  readonly defaultEdgeOptions?: DefaultEdgeOptions;
  readonly reconnectRadius: number;
};

/** Internal renderer iterating the edge id list into `EdgeWrapper`s. */
export const EdgeRenderer = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeRendererProps<EdgeType>,
): JSX.Element => {
  const { store } = useInternalSolidFlow();
  return (
    <div class="solid-flow__edges">
      <MarkerDefinition />

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
