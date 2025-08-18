import { For } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";

import { Marker } from "./Marker";

export const MarkerDefinition = () => {
  const { store } = useInternalSolidFlow();

  return (
    <defs>
      <For each={store.markers}>{(marker) => <Marker {...marker} />}</For>
    </defs>
  );
};
