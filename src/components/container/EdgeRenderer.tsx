import type { JSX } from "@solidjs/web";
import { createMemo, For, Show } from "solid-js";

import { EdgeWrapper } from "@/components/edge";
import { MarkerDefinition } from "@/components/marker";
import { useInternalSolidFlow } from "@/contexts";
import { isEdgeCulled } from "@/core";
import type { Edge, EdgeEvents, Node } from "@/types";

import { createFocusedIdTracker } from "./focusedIdTracker";

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
  const { focusedId: focusedEdgeId, onFocusIn, onFocusOut } = createFocusedIdTracker();

  return (
    <div class="solid-flow__edges" onFocusIn={onFocusIn} onFocusOut={onFocusOut}>
      <MarkerDefinition />

      <For each={store.visibleEdgeIds}>
        {(edgeId) => {
          // Opt-in unmount culling — same per-row equality-cut shape as
          // NodeRenderer (see the comment there and bench round 6).
          const unmounted = createMemo(() => {
            if (!store.onlyRenderVisibleElements || focusedEdgeId() === edgeId) return false;
            const edge = actions.getLayoutedEdge(edgeId);
            return !!edge && isEdgeCulled(edge, store.cullingViewport);
          });

          // Membership comes from the user-facing edges store; an edge whose
          // endpoints are not layouted yet has a null row — do not mount it.
          return (
            <Show when={!unmounted() && actions.getLayoutedEdge(edgeId) != null}>
              <EdgeWrapper<NodeType, EdgeType>
                edgeId={edgeId}
                onEdgeClick={props.onEdgeClick}
                onEdgeDoubleClick={props.onEdgeDoubleClick}
                onEdgePointerMove={props.onEdgePointerMove}
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
