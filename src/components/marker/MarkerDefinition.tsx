import type { JSX } from "@solidjs/web";
import { createMemo, For, Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import { createMarkerIndex } from "@/core/projections/markers";

import { Marker, type MarkerProps } from "./Marker";

/** Internal collector rendering every unique edge marker into one SVG defs block. */
export const MarkerDefinition = (): JSX.Element => {
  const { store } = useInternalSolidFlow();

  // Keyed by marker id, derived per edge (core/projections/markers.ts): the
  // list below re-runs only when the SET of unique markers changes.
  const markerIndex = createMarkerIndex({
    get edges() {
      return store.edges;
    },
    get id() {
      return store.id;
    },
    get defaultColor() {
      return store.defaultMarkerColor;
    },
    get defaultMarkerStart() {
      return store.defaultEdgeOptions.markerStart;
    },
    get defaultMarkerEnd() {
      return store.defaultEdgeOptions.markerEnd;
    },
  });
  const markers = createMemo(
    () => Object.values(markerIndex).sort((a, b) => a.id.localeCompare(b.id)) as MarkerProps[],
    { name: "markers.list" },
  );

  return (
    <Show when={markers().length > 0}>
      <svg class="solid-flow__marker">
        <defs>
          <For each={markers()}>{(marker) => <Marker {...marker} />}</For>
        </defs>
      </svg>
    </Show>
  );
};
