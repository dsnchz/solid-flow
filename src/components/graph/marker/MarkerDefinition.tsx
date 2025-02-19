import { type Component, For } from "solid-js";

import { useFlowStore } from "@/components/contexts";

import Marker from "./Marker";

const MarkerDefinition: Component = () => {
  const { store } = useFlowStore();

  return (
    <defs>
      <For each={store.markers}>{(marker) => <Marker {...marker} />}</For>
    </defs>
  );
};

export default MarkerDefinition;
