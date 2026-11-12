import { isServer } from "@solidjs/web";
import { type createMarkerIds, type EdgeMarkerType, getMarkerId } from "@xyflow/system";
import { type Accessor, createMemo, createSignal } from "solid-js";

/** One rendered marker definition (the system helper's output element). */
export type MarkerEntry = ReturnType<typeof createMarkerIds>[number];

export type EdgeMarkerOptions = {
  readonly id: string;
  readonly defaultColor?: string | null;
  readonly defaultMarkerStart?: EdgeMarkerType;
  readonly defaultMarkerEnd?: EdgeMarkerType;
};

export type EdgeMarkers = {
  /** Reactive: the unique marker definitions, sorted by id (upstream createMarkerIds). */
  readonly list: Accessor<readonly MarkerEntry[]>;
  /** An edge's own `markerStart` / `markerEnd` (reported on every run; same values are no-ops). */
  readonly set: (
    edgeId: string,
    start: EdgeMarkerType | undefined,
    end: EdgeMarkerType | undefined,
  ) => void;
  readonly remove: (edgeId: string) => void;
};

const sameMarkers = (a: readonly MarkerEntry[], b: readonly MarkerEntry[]) =>
  a.length === b.length && a.every((m, i) => m.id === b[i]!.id && m.color === b[i]!.color);

type Own = { readonly start: EdgeMarkerType | undefined; readonly end: EdgeMarkerType | undefined };

/**
 * The unique edge markers, fed by the edge rows (#22): each edge row (hot
 * derive or cold memo) reports its own two marker values, where a memo per
 * edge (and a record merge reading all of them) re-read them for every edge
 * of the graph. Only edges with a marker of their own are kept; the rest
 * are a count, since all they contribute is the default markers.
 *
 * The list is one memo over those (O(edges with markers) per change),
 * equality-cut on id + color (the id encodes every other field): a
 * same-marker rewrite or a fresh object of an equal marker wakes nothing
 * downstream. Semantics are @xyflow/system's createMarkerIds: object
 * markers only, `edge.marker || default`, deduped by id, the default color
 * for a marker without one.
 */
export const createEdgeMarkers = (options: EdgeMarkerOptions): EdgeMarkers => {
  const own = new Map<string, Own>();
  const edges = new Set<string>();
  let withStart = 0;
  let withEnd = 0;
  const [version, setVersion] = createSignal(0, { ownedWrite: true, name: "markers.reports" });
  // The list reads the own markers and, for the defaults, only whether some
  // edge lacks a start / end of its own: an edge without markers coming or
  // going wakes it only when that flips (a 10k bulk delete writes nothing).
  const lacks = () => (edges.size > withStart ? 1 : 0) | (edges.size > withEnd ? 2 : 0);
  const changed = () => {
    if (!isServer) setVersion((n) => n + 1);
  };

  /** Drops the edge; whether its own markers were part of the list. */
  const drop = (edgeId: string): boolean => {
    if (!edges.delete(edgeId)) return false;
    const previous = own.get(edgeId);
    if (!previous) return false;
    own.delete(edgeId);
    if (previous.start) withStart--;
    if (previous.end) withEnd--;
    return true;
  };

  const remove = (edgeId: string) => {
    const before = lacks();
    if (drop(edgeId) || lacks() !== before) changed();
  };

  const list = createMemo(
    (): readonly MarkerEntry[] => {
      version();
      const { id, defaultColor, defaultMarkerStart, defaultMarkerEnd } = options;
      const seen = new Set<string>();
      const out: MarkerEntry[] = [];
      const add = (marker: EdgeMarkerType | undefined) => {
        if (!marker || typeof marker !== "object") return;
        const markerId = getMarkerId(marker, id);
        if (seen.has(markerId)) return;
        seen.add(markerId);
        out.push({ id: markerId, color: marker.color || defaultColor, ...marker });
      };
      for (const { start, end } of own.values()) {
        add(start || defaultMarkerStart);
        add(end || defaultMarkerEnd);
      }
      if (edges.size > withStart) add(defaultMarkerStart);
      if (edges.size > withEnd) add(defaultMarkerEnd);
      return out.sort((a, b) => a.id.localeCompare(b.id));
    },
    { equals: sameMarkers, name: "markers" },
  );

  return {
    list,
    set: (edgeId, start, end) => {
      const previous = own.get(edgeId);
      if (edges.has(edgeId)) {
        if ((previous?.start ?? undefined) === (start || undefined)) {
          if ((previous?.end ?? undefined) === (end || undefined)) return;
        }
      }
      const before = lacks();
      let listChanged = drop(edgeId);
      edges.add(edgeId);
      if (start || end) {
        own.set(edgeId, { start: start || undefined, end: end || undefined });
        if (start) withStart++;
        if (end) withEnd++;
        listChanged = true;
      }
      if (listChanged || lacks() !== before) changed();
    },
    remove,
  };
};
