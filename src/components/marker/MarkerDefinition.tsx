import type { JSX } from "@solidjs/web";
import { createMarkerIds } from "@xyflow/system";
import { createMemo, For, Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import type { Edge } from "@/types";

import { Marker, type MarkerProps } from "./Marker";

/** Internal collector rendering every unique edge marker into one SVG defs block. */
export const MarkerDefinition = (): JSX.Element => {
  const { store } = useInternalSolidFlow();

  const markers = createMemo(() => {
    return createMarkerIds(store.edges as Edge[], {
      id: store.id,
      defaultColor: store.defaultMarkerColor,
      defaultMarkerStart: store.defaultEdgeOptions.markerStart,
      defaultMarkerEnd: store.defaultEdgeOptions.markerEnd,
    }) as MarkerProps[];
  });

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
