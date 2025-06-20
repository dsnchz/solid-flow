import type { ParentProps } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";

export const Viewport = (props: ParentProps) => {
  const { store } = useInternalSolidFlow();

  return (
    <div
      // TODO: Figure out why nodes disappear when we remove the xyflow__viewport class.
      class="solid-flow__container solid-flow__viewport xyflow__viewport"
      style={{
        transform: `translate(${store.viewport.x}px, ${store.viewport.y}px) scale(${store.viewport.zoom})`,
      }}
    >
      {props.children}
    </div>
  );
};

export default Viewport;
