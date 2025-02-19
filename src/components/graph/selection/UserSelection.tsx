import { type Component } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import Selection from "@/components/graph/selection/Selection";

const UserSelection: Component = () => {
  const { store } = useFlowStore();

  return (
    <Selection
      isVisible={!!store.selectionRect && store.selectionRectMode === "user"}
      width={store.selectionRect?.width}
      height={store.selectionRect?.height}
      x={store.selectionRect?.x}
      y={store.selectionRect?.y}
    />
  );
};

export default UserSelection;
