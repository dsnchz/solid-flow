import type { ParentComponent } from "solid-js";

import { useFlowStore } from "@/components/contexts";

const Viewport: ParentComponent = (props) => {
  const { store } = useFlowStore();

  return (
    <div
      class="solid-flow__viewport xyflow__viewport"
      style={{
        transform: `translate(${store.viewport.x}px, ${store.viewport.y}px) scale(${store.viewport.zoom})`,
      }}
    >
      {props.children}
    </div>
  );
};

export default Viewport;
