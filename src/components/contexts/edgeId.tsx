import { type Accessor, createContext, useContext } from "solid-js";

export const EdgeIdContext = createContext<Accessor<string>>();

export function useEdgeId() {
  const ctx = useContext(EdgeIdContext);

  if (!ctx) {
    throw new Error(
      "solid-flow: Your application must be wrapped with <SolidFlow> in order to invoke useEdgeId",
    );
  }

  return ctx;
}
