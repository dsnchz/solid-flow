import { createProjection } from "solid-js";

import type { Edge } from "~/types";

export type EdgeLookupSource<EdgeType extends Edge = Edge> = {
  readonly edges: readonly EdgeType[];
};

/**
 * Trivial id index over the user's edges. Values are the edge store rows
 * themselves (identity-stable), so consumers reading `edgeLookup[id].selected`
 * subscribe at leaf granularity exactly as if they read through the array.
 */
export const createEdgeLookup = <EdgeType extends Edge = Edge>(
  source: EdgeLookupSource<EdgeType>,
): Record<string, EdgeType> => {
  return createProjection<Record<string, EdgeType>>(
    () => {
      const out: Record<string, EdgeType> = {};
      for (const edge of source.edges) out[edge.id] = edge;
      return out;
    },
    {},
    { key: "id" },
  );
};
