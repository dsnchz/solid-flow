import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, Show } from "solid-js";

import { EdgeWrapper } from "@/components/edge";
import { MarkerDefinition } from "@/components/marker";
import { useInternalSolidFlow } from "@/contexts";
import { isEdgeCulled } from "@/core";
import type { Edge, EdgeEvents, Node } from "@/types";

type EdgeRendererProps<EdgeType extends Edge = Edge> = EdgeEvents<EdgeType>;

/** Internal renderer iterating the edge id list into `EdgeWrapper`s. */
export const EdgeRenderer = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeRendererProps<EdgeType>,
): JSX.Element => {
  const { store, actions } = useInternalSolidFlow();

  // The unmount tier's focus guard for keyboard-focused edges (the focusable
  // `g` carries data-id and focusin bubbles here). Edge-LABEL content lives
  // in the portaled label layer and is not seen by this listener — labels
  // are interacted with on selected edges, and selected edges never cull.
  const [focusedEdgeId, setFocusedEdgeId] = createSignal<string | null>(null);

  const onFocusIn = (event: FocusEvent) => {
    const edgeElement = (event.target as Element).closest("[data-id]");
    setFocusedEdgeId(edgeElement?.getAttribute("data-id") ?? null);
  };

  return (
    <div class="solid-flow__edges" onFocusIn={onFocusIn} onFocusOut={() => setFocusedEdgeId(null)}>
      <MarkerDefinition />

      <For each={store.visibleEdgeIds}>
        {(edgeId) => {
          // Opt-in unmount culling — same per-row equality-cut shape as
          // NodeRenderer (see the comment there and bench round 6).
          const unmounted = createMemo(() => {
            if (!store.onlyRenderVisibleElements || focusedEdgeId() === edgeId) return false;
            const edge = actions.getEdge(edgeId);
            return !!edge && isEdgeCulled(edge, store.cullingViewport);
          });

          return (
            <Show when={!unmounted()}>
              <EdgeWrapper<NodeType, EdgeType>
                edgeId={edgeId}
                onEdgeClick={props.onEdgeClick}
                onEdgeContextMenu={props.onEdgeContextMenu}
                onEdgePointerEnter={props.onEdgePointerEnter}
                onEdgePointerLeave={props.onEdgePointerLeave}
              />
            </Show>
          );
        }}
      </For>
    </div>
  );
};
