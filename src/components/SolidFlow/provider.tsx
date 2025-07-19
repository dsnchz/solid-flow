import { type Context, mergeProps, onCleanup, type ParentProps } from "solid-js";

import { createSolidFlow } from "@/data/createSolidFlow";
import { getDefaultFlowStateProps } from "@/data/defaults";
import type { Edge, Node } from "@/types";

import { SolidFlowContext, type SolidFlowContextValue } from "../contexts/flow";
import type { SolidFlowProps } from "./types";

export const SolidFlowProvider = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<SolidFlowProps<NodeType, EdgeType>>,
) => {
  const _props = mergeProps(getDefaultFlowStateProps<NodeType, EdgeType>(), props);
  const solidFlow = createSolidFlow(_props);

  onCleanup(() => {
    solidFlow.actions.reset();
  });

  // Since we cannot pass generic type info at the point of context creation, we need to cast it here
  const ContextProvider = (
    SolidFlowContext as unknown as Context<SolidFlowContextValue<NodeType, EdgeType>>
  ).Provider;

  return <ContextProvider value={solidFlow}>{props.children}</ContextProvider>;
};
