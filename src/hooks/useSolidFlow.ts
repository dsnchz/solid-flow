import { useInternalSolidFlow } from "@/contexts";
import type { FlowCommands, FlowState } from "@/core";
import type { Edge, Node } from "@/types";

/**
 * The canonical flow API: the reactive {@link FlowState} struct plus the
 * {@link FlowCommands} write surface. Every command is also spread onto the
 * returned object directly for upstream (React Flow / Svelte Flow)
 * familiarity — `useSolidFlow().fitView()` and
 * `useSolidFlow().commands.fitView()` are the same function.
 *
 * There are no imperative getters: event handlers are untracked scopes in
 * Solid, so reading `flow.viewport.zoom` (or `flow.internalNodes[id]`) inside
 * one already IS the imperative read — while the same read in a tracked scope
 * subscribes.
 */
export type UseSolidFlowReturn<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = FlowCommands<NodeType, EdgeType> & {
  /** The flow's data graph as one reactive struct — the canonical read surface. */
  readonly flow: FlowState<NodeType, EdgeType>;
  /** The flow's write surface (same functions as the spread members). */
  readonly commands: FlowCommands<NodeType, EdgeType>;
};

/**
 * Hook for accessing the flow instance: `{ flow, commands }` plus the
 * commands spread at the top level for upstream familiarity.
 *
 * `flow` and `commands` are stable identities, so destructuring them is safe:
 * `const { flow, commands } = useSolidFlow()`.
 *
 * @public
 * @returns the flow's read struct and write surface
 */
export function useSolidFlow<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): UseSolidFlowReturn<NodeType, EdgeType> {
  const { flow, commands } = useInternalSolidFlow<NodeType, EdgeType>();

  return {
    ...commands,
    flow,
    commands,
  };
}
