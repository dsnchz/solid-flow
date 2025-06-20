import { type Accessor, createContext, useContext } from "solid-js";

export const NodeConnectableContext = createContext<Accessor<boolean>>();

export function useNodeConnectable() {
  const ctx = useContext(NodeConnectableContext);

  if (!ctx) {
    throw new Error(
      "solid-flow: Your application must be wrapped with <SolidFlow> in order to invoke useNodeConnectable",
    );
  }

  return ctx;
}
