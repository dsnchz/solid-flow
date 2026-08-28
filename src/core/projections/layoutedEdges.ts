import {
  type ConnectionMode,
  getEdgePosition,
  getElevatedEdgeZIndex,
  type OnError,
  type ZIndexMode,
} from "@xyflow/system";
import { createProjection, mapArray } from "solid-js";

import type { DefaultEdgeOptions, Edge, EdgeLayouted, InternalNode, Node } from "@/types";

import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import { createRowRecordProjection } from "./rowRecord";

/**
 * The reactive inputs of the layout join, expressed structurally so the
 * internal store satisfies it and headless tests can supply a plain object.
 * Every property read is a live subscription.
 */
export type LayoutedEdgesSource<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly edges: readonly EdgeType[];
  /** Flow-driven selection sidecar, joined with `edge.selected` per row. */
  readonly selectionOverlay: SelectionOverlay;
  readonly connectionMode: string;
  readonly defaultEdgeOptions: DefaultEdgeOptions;
  readonly elevateEdgesOnSelect: boolean;
  readonly zIndexMode?: ZIndexMode;
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
 * The viewport never participates here: #15 culling is CSS-only, applied by
 * EdgeWrapper from the quantized culling viewport — panning must not touch
 * edge rows, and the record's membership must not change as edges cross the
 * viewport (no mount/unmount churn).
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
          // (rc.1 carried post-build dependency re-asserts here — first
          // nested derives could strand subscriptions; fixed upstream in
          // solidjs/solid#3037, removed with the rc.2 bump.)
          return { row: buildRow(source, edge) };
        },
        { row: null },
        { key: "id" },
      );
      return { id, store };
    },
    { keyed: (edge) => edge.id },
  );

  // Shared keyed-record tail — see createRowRecordProjection.
  return createRowRecordProjection(rowStores);
};

const buildRow = <NodeType extends Node, EdgeType extends Edge>(
  source: LayoutedEdgesSource<NodeType, EdgeType>,
  edge: EdgeType,
): EdgeLayouted<EdgeType> | null => {
  const sourceNode = source.nodeLookup.get(edge.source);
  const targetNode = source.nodeLookup.get(edge.target);

  if (!sourceNode || !targetNode) {
    return null;
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

  const selected = joinSelected(edge.selected, overlayEntry(source.selectionOverlay, edge.id));

  return {
    ...source.defaultEdgeOptions,
    ...edge,
    selected,
    ...edgePosition,
    zIndex: getElevatedEdgeZIndex({
      selected,
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
