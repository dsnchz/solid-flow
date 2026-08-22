import {
  type ConnectionMode,
  getEdgePosition,
  getElevatedEdgeZIndex,
  isEdgeVisible,
  type OnError,
  type Transform,
  type ZIndexMode,
} from "@xyflow/system";
import { createProjection, mapArray } from "solid-js";

import type { DefaultEdgeOptions, Edge, EdgeLayouted, InternalNode, Node } from "~/types";

/**
 * The reactive inputs of the layout join, expressed structurally so the
 * internal store satisfies it and headless tests can supply a plain object.
 * Every property read is a live subscription.
 */
export type LayoutedEdgesSource<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly edges: readonly EdgeType[];
  readonly connectionMode: string;
  readonly defaultEdgeOptions: DefaultEdgeOptions;
  readonly elevateEdgesOnSelect: boolean;
  readonly zIndexMode?: ZIndexMode;
  readonly onlyRenderVisibleElements: boolean;
  readonly width: number;
  readonly height: number;
  readonly transform: Transform;
  readonly onError?: OnError;
  readonly nodeLookup: Pick<Map<string, InternalNode<NodeType>>, "get" | "size">;
};

/**
 * Edge layout join: user edges × internal nodes → screen-space edge geometry,
 * decomposed into SUB-STORES (spike 13): each edge is its own keyed
 * projection holding `{ row }` — the layouted row, or null while the edge
 * produces none (missing/unready endpoints, culled) — and the public record
 * is a SHALLOW projection holding the PRESENT rows' proxies by reference.
 *
 * Reads chain: `record[id].sourceX` goes through the shallow slot into the
 * edge's own store, so every materialized leaf signal hangs off its EDGE's
 * computed (defeating rc.1's per-update companion walk — see
 * internalNodes.ts). The edge projection tracks exactly what the join reads —
 * the edge's props and its endpoints' geometry leaves through nodeLookup
 * (which chains into the node row stores) — so one node move re-runs only
 * the adjacent edges' projections; the record computed re-runs only when
 * membership or presence changes.
 *
 * The viewport participates only while onlyRenderVisibleElements is active —
 * panning must not touch edge rows otherwise.
 *
 * Rows whose endpoints are missing or unmeasured simply drop out of the
 * record — the same "no entry" contract the ReactiveMap pipeline had.
 */
export const createLayoutedEdges = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  source: LayoutedEdgesSource<NodeType, EdgeType>,
): Record<string, EdgeLayouted<EdgeType>> => {
  const rowStores = mapArray(
    () => source.edges,
    (edgeAccessor) => {
      const id = edgeAccessor().id;
      const store: { row: EdgeLayouted<EdgeType> | null } = createProjection<{
        row: EdgeLayouted<EdgeType> | null;
      }>(
        // the accessor tracks the item slot: a controlled array reset swaps
        // the edge object while THIS row store (keyed by id) survives, so
        // downstream subscriptions never strand on disposed stores
        () => {
          const edge = edgeAccessor();
          const row = buildRow(source, edge);
          // Re-assert the node-side dependencies AFTER the build: during the
          // FIRST nested derive (while the node record commits lazily beneath
          // this read) reads made inside buildRow can fail to register —
          // browser-verified: the first edge stranded with zero
          // subscriptions. Reading the presence-deciding leaves here, at the
          // end, reliably registers them. Upstream issue candidate.
          void source.nodeLookup.get(edge.source)?.internals.handleBounds;
          void source.nodeLookup.get(edge.target)?.internals.handleBounds;
          return { row };
        },
        { row: null },
        { key: "id" },
      );
      return { id, store };
    },
    { keyed: (edge) => edge.id },
  );

  // The public record: SHALLOW, holding the PRESENT rows' proxies by
  // reference. Slots are re-assigned by ROW-PROXY reference: present→present
  // content updates merge into the same backing object (no reassignment, no
  // record update); presence flips and same-id edge replacements repoint or
  // drop the slot. Draft form: removed ids must be deleted explicitly
  // (assigning undefined would keep the own key — spike 09).
  const assigned = new Map<string, EdgeLayouted<EdgeType>>();
  return createProjection<Record<string, EdgeLayouted<EdgeType>>>(
    (draft) => {
      const seen = new Set<string>();
      for (const { id, store } of rowStores()) {
        const row = store.row;
        if (!row) continue;
        seen.add(id);
        if (assigned.get(id) !== row) {
          assigned.set(id, row);
          draft[id] = row;
        }
      }
      for (const id of assigned.keys()) {
        if (!seen.has(id)) {
          assigned.delete(id);
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
          delete draft[id];
        }
      }
    },
    {},
    { key: null, shallow: true },
  );
};

const buildRow = <NodeType extends Node, EdgeType extends Edge>(
  source: LayoutedEdgesSource<NodeType, EdgeType>,
  edge: EdgeType,
): EdgeLayouted<EdgeType> | null => {
  const sourceNode = source.nodeLookup.get(edge.source);
  const targetNode = source.nodeLookup.get(edge.target);

  if (!sourceNode || !targetNode) {
    // Membership subscription: a get/`in` on an ABSENT key does not subscribe
    // inside a projection derive (the absent-key footgun) — and during the
    // first nested derive the shallow node record's keys may not even have
    // committed yet, which permanently stranded the first edge (no node-side
    // subscriptions at all). A structural read (size ~ Object.keys) reliably
    // re-runs this row when node membership changes.
    void source.nodeLookup.size;
    return null;
  }

  if (source.onlyRenderVisibleElements) {
    const edgeVisible = isEdgeVisible({
      sourceNode,
      targetNode,
      width: source.width ?? 0,
      height: source.height ?? 0,
      transform: source.transform,
    });

    if (!edgeVisible) return null;
  }

  const edgePosition = getEdgePosition({
    id: edge.id,
    sourceNode,
    targetNode,
    sourceHandle: edge.sourceHandle || null,
    targetHandle: edge.targetHandle || null,
    connectionMode: source.connectionMode as ConnectionMode,
    onError: source.onError,
  });

  if (!edgePosition) return null;

  return {
    ...source.defaultEdgeOptions,
    ...edge,
    ...edgePosition,
    zIndex: getElevatedEdgeZIndex({
      selected: edge.selected,
      zIndex: edge.zIndex ?? source.defaultEdgeOptions.zIndex,
      sourceNode,
      targetNode,
      elevateOnSelect: source.elevateEdgesOnSelect,
      zIndexMode: source.zIndexMode,
    }),
    sourceNode,
    targetNode,
    edge,
  };
};
