import { createMarkerIds } from "@xyflow/system";
import { createMemo, For, Show } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";

import { Marker, type MarkerProps } from "./Marker";

export const MarkerDefinition = () => {
  const { store } = useInternalSolidFlow();

  const markers = createMemo(() => {
    return createMarkerIds(store.edges, {
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
