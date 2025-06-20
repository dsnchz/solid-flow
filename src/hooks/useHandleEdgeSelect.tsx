import { errorMessages } from "@xyflow/system";

import { useInternalSolidFlow } from "@/components/contexts";

export function useHandleEdgeSelect() {
  const { store, edgeLookup, addSelectedEdges, unselectNodesAndEdges, setStore } =
    useInternalSolidFlow();

  return (id: string) => {
    const edge = edgeLookup.get(id);

    if (!edge) {
      console.warn("012", errorMessages["error012"](id));
      return;
    }

    const selectable =
      edge.selectable || (store.elementsSelectable && typeof edge.selectable === "undefined");

    if (selectable) {
      setStore({ selectionRect: undefined, selectionRectMode: undefined });

      if (!edge.selected) {
        addSelectedEdges([id]);
      } else if (edge.selected && store.multiselectionKeyPressed) {
        unselectNodesAndEdges({ nodes: [], edges: [edge] });
      }
    }
  };
}
