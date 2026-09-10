import { createMarkerIds, type EdgeMarker } from "@xyflow/system";
import { createMemo, createProjection, mapArray } from "solid-js";

import type { Edge } from "@/types";

/** One rendered marker definition (the system helper's output element). */
export type MarkerEntry = ReturnType<typeof createMarkerIds>[number];

export type MarkerIndexSource<EdgeType extends Edge = Edge> = {
  readonly edges: readonly EdgeType[];
  readonly id: string;
  readonly defaultColor?: string | null;
  readonly defaultMarkerStart?: EdgeMarker | string;
  readonly defaultMarkerEnd?: EdgeMarker | string;
};

const sameMarkers = (a: readonly MarkerEntry[], b: readonly MarkerEntry[]) =>
  a.length === b.length && a.every((m, i) => m.id === b[i]!.id && m.color === b[i]!.color);

/**
 * Unique edge markers as an id-keyed record. `createMarkerIds` over ALL edges
 * read two leaves of every edge (rc.7 HUGE_FAN_IN: ~2k-3.5k sources @900
 * edges) and re-ran on any edge's marker write. Here each edge owns a memo
 * over its own two marker leaves (equality-cut on id + color — the marker id
 * already encodes every other field), and the record merge reads E memos.
 * Render `Object.values(record)` sorted by id for upstream parity.
 */
export const createMarkerIndex = <EdgeType extends Edge = Edge>(
  source: MarkerIndexSource<EdgeType>,
): Record<string, MarkerEntry> => {
  const rows = createMemo(
    mapArray(
      () => source.edges,
      (edge) =>
        createMemo(
          () =>
            createMarkerIds([edge] as Edge[], {
              id: source.id,
              defaultColor: source.defaultColor ?? undefined,
              defaultMarkerStart: source.defaultMarkerStart,
              defaultMarkerEnd: source.defaultMarkerEnd,
            }),
          { equals: sameMarkers, name: "markers.row" },
        ),
    ),
    { name: "markers.rows" },
  );

  return createProjection<Record<string, MarkerEntry>>(
    () => {
      const out: Record<string, MarkerEntry> = {};
      for (const row of rows()) {
        for (const marker of row()) out[marker.id] ??= marker;
      }
      return out;
    },
    {},
    { key: "id", name: "markers" },
  );
};
