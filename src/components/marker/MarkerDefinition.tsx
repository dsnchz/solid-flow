import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";

import { Marker, type MarkerProps } from "./Marker";

/** Internal collector rendering every unique edge marker into one SVG defs block. */
export const MarkerDefinition = (): JSX.Element => {
  // Reported by the edge rows (core/projections/markers.ts): the list
  // changes only when the SET of unique markers does.
  const { markers } = useInternalSolidFlow();

  return (
    <Show when={markers().length > 0}>
      <svg class="solid-flow__marker">
        <defs>
          <For each={markers() as MarkerProps[]}>{(marker) => <Marker {...marker} />}</For>
        </defs>
      </svg>
    </Show>
  );
};
