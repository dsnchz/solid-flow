import type { Rect } from "@xyflow/system";
import { createMemo } from "solid-js";

import type { GeometryFeed } from "../geometryFeed";
import type { EdgeEndpoints } from "./resolvedEdges";

export type EdgeBoxesSource = {
  /** The node rects (the node row derives' and cold rows' feed). */
  readonly nodes: Pick<GeometryFeed<Rect>, "map" | "changes" | "createDrain">;
  /** Each edge's endpoint ids, reported by its cold memo or its row. */
  readonly endpoints: Pick<GeometryFeed<EdgeEndpoints>, "map" | "changes" | "takeChanged">;
};

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

const sameRect = (a: Rect | undefined, b: Rect | null): boolean =>
  a === undefined
    ? b === null
    : b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Each edge's culling box: the union of its endpoints' node rects, as
 * @xyflow/system's isEdgeVisible draws it (React Flow / Svelte Flow parity),
 * written to `out` (the edge on-screen membership's feed). It needs no edge
 * row and no node row, only the plain rect map, so cold edges cull (#22).
 *
 * One eager memo per flow: an endpoint report re-boxes that edge; a node
 * report re-boxes the edges indexed under the node (an adjacency map kept
 * from the endpoint reports), so a node drag re-boxes its own edges only.
 * An edge with an endpoint that has no rect has no box (never on screen).
 */
export const createEdgeBoxes = (source: EdgeBoxesSource, out: GeometryFeed<Rect>): void => {
  const takeNodeChanged = source.nodes.createDrain();
  const attached = new Map<string, EdgeEndpoints>();
  const edgesOf = new Map<string, Set<string>>();

  const attach = (nodeId: string, edgeId: string) => {
    let edges = edgesOf.get(nodeId);
    if (edges === undefined) edgesOf.set(nodeId, (edges = new Set()));
    edges.add(edgeId);
  };
  const detach = (nodeId: string, edgeId: string) => {
    const edges = edgesOf.get(nodeId);
    if (edges?.delete(edgeId) && edges.size === 0) edgesOf.delete(nodeId);
  };

  // eslint-disable-next-line solid/reactivity -- an eager memo nobody reads: it writes `out` (see above)
  createMemo(
    () => {
      source.endpoints.changes();
      source.nodes.changes();
      const dirty = new Set<string>();
      for (const edgeId of source.endpoints.takeChanged()) {
        const previous = attached.get(edgeId);
        if (previous) {
          detach(previous.source, edgeId);
          detach(previous.target, edgeId);
        }
        const next = source.endpoints.map.get(edgeId);
        if (next) {
          attach(next.source, edgeId);
          attach(next.target, edgeId);
          attached.set(edgeId, next);
        } else {
          attached.delete(edgeId);
        }
        dirty.add(edgeId);
      }
      for (const nodeId of takeNodeChanged()) {
        const edges = edgesOf.get(nodeId);
        if (edges) for (const edgeId of edges) dirty.add(edgeId);
      }
      const rects = source.nodes.map;
      for (const edgeId of dirty) {
        const ends = attached.get(edgeId);
        const sourceRect = ends && rects.get(ends.source);
        const targetRect = ends && rects.get(ends.target);
        const box = sourceRect && targetRect ? union(sourceRect, targetRect) : null;
        if (!sameRect(out.map.get(edgeId), box)) out.report(edgeId, box);
      }
    },
    { name: "edgeBoxes" },
  );
};
