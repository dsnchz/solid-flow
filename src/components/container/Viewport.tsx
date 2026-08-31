import type { JSX } from "@solidjs/web";
import type { ParentProps } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";

export const Viewport = (props: ParentProps): JSX.Element => {
  const { store } = useInternalSolidFlow();

  return (
    <div
      // `xyflow__viewport` is a LOAD-BEARING upstream contract, independent of
      // the `lib` class prefix: @xyflow/system's updateNodeInternals resolves
      // the current zoom via `domNode.querySelector(".xyflow__viewport")` and
      // bails out (no measurements -> nodes never appear) when it's missing.
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
