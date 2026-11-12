import { type Accessor, useContext } from "solid-js";

import { NodeContext } from "./nodeId";

export function useNodeConnectable(): Accessor<boolean> {
  const ctx = useContext(NodeContext);

  if (!ctx) {
    throw new Error(
      "solid-flow: Your application must be wrapped with <SolidFlow> in order to invoke useNodeConnectable",
    );
  }

  return ctx.connectable;
}
