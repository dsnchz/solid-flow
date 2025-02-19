import { type Component, For, Show } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import CallOnMount from "@/components/utility/CallOnMount";
import type { EdgeComponentKey } from "@/data/types";
import type { DefaultEdgeOptions, EdgeEventCallbacks } from "@/shared/types";

import EdgeWrapper from "../graph/edge/EdgeWrapper";
import { MarkerDefinition } from "../graph/marker";

type EdgeRendererProps = Partial<EdgeEventCallbacks> & {
  readonly defaultEdgeOptions?: DefaultEdgeOptions;
};

const EdgeRenderer: Component<EdgeRendererProps> = (props) => {
  const { store, setStore } = useFlowStore();

  return (
    <div class="solid-flow__edges">
      <svg class="solid-flow__marker">
        <MarkerDefinition />
      </svg>

      <For each={store.visibleEdges}>
        {(edge) => {
          const edgeType = () => (edge.type || "default") as EdgeComponentKey;
          const selectable = () => edge.selectable ?? store.elementsSelectable;

          return (
            <EdgeWrapper
              {...edge}
              selectable={selectable()}
              type={edgeType()}
              onEdgeClick={props.onEdgeClick}
              onEdgeContextMenu={props.onEdgeContextMenu}
              onEdgeMouseEnter={props.onEdgeMouseEnter}
              onEdgeMouseLeave={props.onEdgeMouseLeave}
            />
          );
        }}
      </For>

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
    </div>
  );
};

export default EdgeRenderer;
