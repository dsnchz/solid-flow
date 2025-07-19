import { errorMessages } from "@xyflow/system";
import { batch } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";

export function useHandleEdgeSelect() {
  const { store, edgeLookup, actions } = useInternalSolidFlow();

  return (id: string) => {
    const edge = edgeLookup.get(id);

    if (!edge) {
      console.warn("012", errorMessages["error012"](id));
      return;
    }

    const selectable =
      edge.selectable || (store.elementsSelectable && typeof edge.selectable === "undefined");

    if (selectable) {
      batch(() => {
        actions.setSelectionRect(undefined);
        actions.setSelectionRectMode(undefined);

        if (!edge.selected) {
          actions.addSelectedEdges([id]);
        } else if (edge.selected && store.multiselectionKeyPressed) {
          actions.unselectNodesAndEdges({ nodes: [], edges: [edge] });
        }
      });
    }
  };
}
