import { createProjection } from "solid-js";

import type { Node } from "@/types";

export type ParentIdsSource<NodeType extends Node = Node> = {
  readonly nodes: readonly NodeType[];
};

/**
 * The set of node ids that currently have children, as a record projection
 * (`id in parentIds` / `parentIds[id]`): per-key subscriptions, so a node's
 * parent-ness toggling only re-runs that node's subscribers.
 *
 * Derived from the nodes root — unlike the old parentLookup ReactiveMap,
 * which was populated by the adoption pass and never pruned (a node whose
 * children were all removed kept reporting as a parent).
 */
export const createParentIds = <NodeType extends Node = Node>(
  source: ParentIdsSource<NodeType>,
): Record<string, true> => {
  return createProjection<Record<string, true>>(
    () => {
      const out: Record<string, true> = {};
      for (const node of source.nodes) {
        if (node.parentId) out[node.parentId] = true;
      }
      return out;
    },
    {},
    { key: "id" },
  );
};
