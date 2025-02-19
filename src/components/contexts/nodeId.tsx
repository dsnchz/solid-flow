import { type Accessor, createContext, useContext } from "solid-js";

export const NodeIdContext = createContext<Accessor<string>>();

export function useNodeId() {
  const ctx = useContext(NodeIdContext);

  if (!ctx) {
    throw new Error(
      "solid-flow: Your application must be wrapped with <SolidFlow> in order to invoke useNodeId",
    );
  }

  return ctx;
}
