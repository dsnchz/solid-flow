import type { JSX } from "@solidjs/web";
import { createMemo, For, Show } from "solid-js";

import { EdgeWrapper } from "@/components/edge";
import { MarkerDefinition } from "@/components/marker";
import { useInternalSolidFlow } from "@/contexts";
import { edgeCulled } from "@/core";
import type { Edge, EdgeEvents, Node } from "@/types";

import { createFocusedIdTracker } from "./focusedIdTracker";

type EdgeRendererProps<EdgeType extends Edge = Edge> = EdgeEvents<EdgeType> & {
  /** See NodeRenderer: edge elements mount once the flow has settled. */
  rowsReady?: () => boolean;
};

const NO_ROWS: readonly string[] = [];

/** Internal renderer iterating the edge id list into `EdgeWrapper`s. */
export const EdgeRenderer = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeRendererProps<EdgeType>,
): JSX.Element => {
  const { store, actions, onScreenEdgeIds } = useInternalSolidFlow<NodeType, EdgeType>();

  // The unmount tier's focus guard for keyboard-focused edges (the focusable
  // `g` carries data-id and focusin bubbles here). Edge-LABEL content lives
  // in the portaled label layer and is not seen by this listener — labels
  // are interacted with on selected edges, and selected edges never cull.
  const { focusedId: focusedEdgeId, onFocusIn, onFocusOut } = createFocusedIdTracker();

  return (
    <div class="solid-flow__edges" onFocusIn={onFocusIn} onFocusOut={onFocusOut}>
      <MarkerDefinition />

      <For each={(props.rowsReady?.() ?? true) ? store.visibleEdgeIds : NO_ROWS}>
        {(edgeId) => {
          // Opt-in unmount culling — same per-row equality-cut shape as
          // NodeRenderer (see the comment there and bench round 6).
          const unmounted = createMemo(() => {
            if (!store.onlyRenderVisibleElements || focusedEdgeId() === edgeId) return false;
            const edge = actions.getResolvedEdge(edgeId);
            return !!edge && edgeCulled(edge, store.cullingActive, onScreenEdgeIds);
          });

          // Membership comes from the user-facing edges store; an edge whose
          // endpoints are not resolved yet has a null row — do not mount it.
          // `hidden` is decided here too — one Show per row, and `when`
          // returns the row for the wrapper (see NodeRenderer, audit C9).
          const visibleRow = () => {
            if (unmounted()) return undefined;
            const edge = actions.getResolvedEdge(edgeId);
            return edge != null && !edge.hidden ? edge : undefined;
          };
          return (
            <Show when={visibleRow()}>
              {(edge) => <EdgeWrapper<NodeType, EdgeType> edge={edge} events={props} />}
            </Show>
          );
        }}
      </For>
    </div>
  );
};
