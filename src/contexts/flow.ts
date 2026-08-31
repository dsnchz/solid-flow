import { type Context, createContext, useContext } from "solid-js";

import { createSolidFlow } from "@/browser/createSolidFlow";
import type { Edge, Node } from "@/types";

export type SolidFlowContextValue<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = ReturnType<typeof createSolidFlow<NodeType, EdgeType>>;

export const SolidFlowContext = createContext<SolidFlowContextValue | null>(null);

/**
 * The ONE place the generic-context cast lives. A context object is created
 * without generic info, so every generic consumer/provider must retype it;
 * the cast is sound because Solid contexts are plain value carriers and the
 * SolidFlow/SolidFlowProvider generics keep provider and consumer on the
 * same instantiation.
 */
export const typedSolidFlowContext = <NodeType extends Node, EdgeType extends Edge>() =>
  SolidFlowContext as unknown as Context<SolidFlowContextValue<NodeType, EdgeType> | null>;

export function useInternalSolidFlow<NodeType extends Node = Node, EdgeType extends Edge = Edge>() {
  const ctx = useContext(typedSolidFlowContext<NodeType, EdgeType>());

  if (!ctx) {
    throw new Error(
      "solid-flow: Your application must be wrapped with <SolidFlow> in order to invoke useInternalSolidFlow within your components",
    );
  }

  return ctx;
}
