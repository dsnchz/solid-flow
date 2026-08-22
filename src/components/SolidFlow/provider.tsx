import type { JSX } from "@solidjs/web";
import { type Context, merge, onCleanup, type ParentProps } from "solid-js";

import { getDefaultFlowStateProps } from "~/core/defaults";
import type { Edge, Node } from "~/types";

import { SolidFlowContext, type SolidFlowContextValue } from "../contexts/flow";
import { createSolidFlow } from "./createSolidFlow";
import type { SolidFlowProps } from "./types";

export const SolidFlowProvider = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<SolidFlowProps<NodeType, EdgeType>>,
): JSX.Element => {
  const _props = merge(getDefaultFlowStateProps<NodeType, EdgeType>(), props);
  const solidFlow = createSolidFlow(_props);

  onCleanup(() => {
    solidFlow.actions.reset();
  });

  // Since we cannot pass generic type info at the point of context creation, we need to cast it here
  // In Solid 2.0 the context object IS the provider component
  const ContextProvider = SolidFlowContext as unknown as Context<
    SolidFlowContextValue<NodeType, EdgeType>
  >;

  return <ContextProvider value={solidFlow}>{props.children}</ContextProvider>;
};
