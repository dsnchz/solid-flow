import { createContext, useContext } from "solid-js";

import { createSolidFlow } from "@/data/createSolidFlow";
import type { Edge, Node } from "@/types";

export type SolidFlowContextValue<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = ReturnType<typeof createSolidFlow<NodeType, EdgeType>>;

export const SolidFlowContext = createContext<SolidFlowContextValue>();

export function useInternalSolidFlow<NodeType extends Node = Node, EdgeType extends Edge = Edge>() {
  // Since we cannot pass generic types info at the point of context creation, we need to cast it here
  const ctx = useContext(SolidFlowContext) as unknown as
    | SolidFlowContextValue<NodeType, EdgeType>
    | undefined;

  if (!ctx) {
    throw new Error(
      "solid-flow: Your application must be wrapped with <SolidFlow> in order to invoke useInternalSolidFlow within your components",
    );
  }

  return ctx;
}
