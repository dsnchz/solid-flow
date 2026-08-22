import type { HandleConnection, HandleType, Viewport } from "@xyflow/system";
import { snapshot } from "solid-js";

import { useInternalSolidFlow } from "~/components/contexts";
import { connectionKey, type FlowCommands, type FlowState } from "~/core";
import type { Edge, InternalNode, Node } from "~/types";

/**
 * The canonical flow API: the reactive {@link FlowState} struct plus the
 * {@link FlowCommands} write surface. Every command is also spread onto the
 * returned object directly for upstream (React Flow / Svelte Flow)
 * familiarity — `useSolidFlow().fitView()` and
 * `useSolidFlow().commands.fitView()` are the same function.
 *
 * The imperative getters are deprecated: event handlers are untracked scopes
 * in Solid, so reading `flow.viewport.zoom` (or `flow.internalNodes[id]`)
 * inside one already IS the imperative read — no wrapper needed — while the
 * same read in a tracked scope subscribes.
 */
export type UseSolidFlowReturn<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = FlowCommands<NodeType, EdgeType> & {
  /** The flow's data graph as one reactive struct — the canonical read surface. */
  flow: FlowState<NodeType, EdgeType>;
  /** The flow's write surface (same functions as the spread members). */
  commands: FlowCommands<NodeType, EdgeType>;
  /** @deprecated Read `flow.internalNodes[id]` instead. */
  getInternalNode: (id: string) => InternalNode<NodeType> | undefined;
  /** @deprecated Read `flow.internalNodes[id]?.internals.userNode` (or find in `flow.nodes`) instead. */
  getNode: (id: string) => NodeType | undefined;
  /** @deprecated Read `flow.nodes` (or map ids over `flow.internalNodes`) instead. */
  getNodes: (ids?: string[]) => NodeType[];
  /** @deprecated Read `flow.edges` (or find by id) instead. */
  getEdge: (id: string) => EdgeType | undefined;
  /** @deprecated Read `flow.edges` (or filter by ids) instead. */
  getEdges: (ids?: string[]) => EdgeType[];
  /** @deprecated Read `flow.viewport` instead. */
  getViewport: () => Viewport;
  /** @deprecated Read `flow.viewport.zoom` instead. */
  getZoom: () => number;
  /** @deprecated Read `flow.connections[connectionKey(nodeId, type, id)]` (or use `useNodeConnections`) instead. */
  getHandleConnections: (params: {
    type: HandleType;
    nodeId: string;
    id?: string | null;
  }) => HandleConnection[];
};

/**
 * Hook for accessing the flow instance: `{ flow, commands }` plus the
 * commands spread at the top level for upstream familiarity.
 *
 * `flow` and `commands` are stable identities, so destructuring them is safe:
 * `const { flow, commands } = useSolidFlow()`.
 *
 * @public
 * @returns the flow's read struct, write surface, and deprecated aliases
 */
export function useSolidFlow<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(): UseSolidFlowReturn<NodeType, EdgeType> {
  const { flow, commands, store, edgeLookup } = useInternalSolidFlow<NodeType, EdgeType>();

  const getInternalNode = (id: string) => flow.internalNodes[id];

  return {
    ...commands,
    flow,
    commands,
    getInternalNode,
    getNode: (id) => getInternalNode(id)?.internals.userNode,
    getNodes: (ids) =>
      !ids
        ? [...flow.nodes]
        : ids.flatMap((id) => {
            const userNode = flow.internalNodes[id]?.internals.userNode;
            return userNode ? [userNode] : [];
          }),
    getEdge: (id) => edgeLookup[id],
    getEdges: (ids) =>
      !ids ? [...flow.edges] : ids.flatMap((id) => (edgeLookup[id] ? [edgeLookup[id]!] : [])),
    getViewport: () => snapshot(store.viewport),
    getZoom: () => flow.viewport.zoom,
    getHandleConnections: ({ type, id, nodeId }) =>
      Object.values(flow.connections[connectionKey(nodeId, type, id ?? null)] ?? {}),
  };
}
