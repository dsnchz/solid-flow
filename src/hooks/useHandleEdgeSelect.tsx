import { errorMessages } from "@xyflow/system";

import { useFlowStore } from "@/components/contexts";

export function useHandleEdgeSelect() {
  const { store, addSelectedEdges, unselectNodesAndEdges, setStore } = useFlowStore();

  return (id: string) => {
    const edge = store.edgeLookup.get(id);

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
