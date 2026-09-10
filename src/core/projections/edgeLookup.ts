import { mapArray } from "solid-js";

import type { Edge } from "@/types";

import { createRowRecordProjection } from "./rowRecord";

export type EdgeLookupSource<EdgeType extends Edge = Edge> = {
  readonly edges: readonly EdgeType[];
};

/**
 * Id index over the user's edges. Values are the edge store rows themselves
 * (identity-stable), so consumers reading `edgeLookup[id].selected` subscribe
 * at leaf granularity exactly as if they read through the array. Keyed
 * mapArray + the shared holder record (see createRowRecordProjection): the
 * item accessor tracks the array slot, so a controlled reset that swaps the
 * edge object repoints the entry while the key survives, and the row is never
 * re-wrapped under the lookup's own projection family.
 */
export const createEdgeLookup = <EdgeType extends Edge = Edge>(
  source: EdgeLookupSource<EdgeType>,
): Record<string, EdgeType> => {
  const rowStores = mapArray(
    () => source.edges,
    (edgeAccessor) => ({
      id: edgeAccessor().id,
      store: {
        get row(): EdgeType | null {
          return edgeAccessor();
        },
      },
    }),
    { keyed: (edge) => edge.id },
  );
  return createRowRecordProjection(rowStores, "edgeLookup");
};
