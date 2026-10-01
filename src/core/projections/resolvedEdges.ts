import {
  type ConnectionMode,
  getEdgePosition,
  type OnError,
  type Rect,
  type ZIndexMode,
} from "@xyflow/system";
import { createMemo, createProjection, mapArray, onCleanup } from "solid-js";

import type { DefaultEdgeOptions, Edge, InternalNode, Node, ResolvedEdge } from "@/types";

import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import { createRowRecordProjection } from "./rowRecord";

/**
 * The reactive inputs of the layout join, expressed structurally so the
 * internal store satisfies it and headless tests can supply a plain object.
 * Every property read is a live subscription.
 */
export type ResolvedEdgesSource<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly edges: readonly EdgeType[];
  /** Flow-driven selection sidecar, joined with `edge.selected` per row. */
  readonly selectionOverlay: SelectionOverlay;
  readonly connectionMode: string;
  readonly defaultEdgeOptions: DefaultEdgeOptions;
  readonly elevateEdgesOnSelect: boolean;
  readonly zIndexMode?: ZIndexMode;
  readonly onError?: OnError;
  readonly nodeLookup: Pick<Map<string, InternalNode<NodeType>>, "get" | "size">;
  /** Called with the edge's segment box whenever it changes, null when the row is gone. */
  readonly onGeometryChange?: (id: string, box: Rect | null) => void;
};

/**
 * Edge layout join: user edges × internal nodes → screen-space edge geometry,
 * decomposed into SUB-STORES (spike 13): each edge is its own keyed
 * projection holding `{ row }` — the resolved row, or null while the edge
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
export const createResolvedEdges = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  source: ResolvedEdgesSource<NodeType, EdgeType>,
): Record<string, ResolvedEdge<EdgeType>> => {
  // The flow settings every edge reads, as ONE memo (value-equal): one read
  // per row run instead of five through the config getters, and a config
  // change that leaves them equal re-runs no edge (bench round 41).
  const settings = createMemo(
    (): EdgeSettings => ({
      connectionMode: source.connectionMode,
      defaultEdgeOptions: source.defaultEdgeOptions,
      elevateEdgesOnSelect: source.elevateEdgesOnSelect,
      zIndexMode: source.zIndexMode,
      onError: source.onError,
    }),
    {
      equals: (a, b) =>
        a.connectionMode === b.connectionMode &&
        a.defaultEdgeOptions === b.defaultEdgeOptions &&
        a.elevateEdgesOnSelect === b.elevateEdgesOnSelect &&
        a.zIndexMode === b.zIndexMode &&
        a.onError === b.onError,
      name: "resolvedEdges.settings",
    },
  );
  const rowStores = mapArray(
    () => source.edges,
    (edgeAccessor) => {
      const id = edgeAccessor().id;
      let geometry = "";
      const store: { row: ResolvedEdge<EdgeType> | null } = createProjection<{
        row: ResolvedEdge<EdgeType> | null;
      }>(
        // the accessor tracks the item slot: a controlled array reset swaps
        // the edge object while THIS row store (keyed by id) survives, so
        // downstream subscriptions never strand on disposed stores
        () => {
          const edge = edgeAccessor();
          // (rc.1 carried post-build dependency re-asserts here — first
          // nested derives could strand subscriptions; fixed upstream in
          // solidjs/solid#3037, removed with the rc.2 bump.)
          const row = buildRow(source, settings(), edge);
          if (source.onGeometryChange) {
            const next = row ? `${row.sourceX},${row.sourceY},${row.targetX},${row.targetY}` : "";
            if (next !== geometry) {
              geometry = next;
              source.onGeometryChange(id, row ? segmentBox(row) : null);
            }
          }
          return { row };
        },
        { row: null },
        { key: "id", name: "resolvedEdges.row" },
      );
      onCleanup(() => {
        if (geometry !== "") source.onGeometryChange?.(id, null);
      });
      return { id, store };
    },
    { keyed: (edge) => edge.id },
  );

  // Shared keyed-record tail — see createRowRecordProjection.
  return createRowRecordProjection(rowStores, "resolvedEdges");
};

const segmentBox = (
  row: Pick<ResolvedEdge, "sourceX" | "sourceY" | "targetX" | "targetY">,
): Rect => ({
  x: Math.min(row.sourceX, row.targetX),
  y: Math.min(row.sourceY, row.targetY),
  width: Math.abs(row.sourceX - row.targetX),
  height: Math.abs(row.sourceY - row.targetY),
});

type EdgeSettings = Pick<
  ResolvedEdgesSource,
  "connectionMode" | "defaultEdgeOptions" | "elevateEdgesOnSelect" | "zIndexMode" | "onError"
>;

const buildRow = <NodeType extends Node, EdgeType extends Edge>(
  source: Pick<ResolvedEdgesSource<NodeType, EdgeType>, "nodeLookup" | "selectionOverlay">,
  settings: EdgeSettings,
  edge: EdgeType,
): ResolvedEdge<EdgeType> | null => {
  const sourceNode = source.nodeLookup.get(edge.source);
  const targetNode = source.nodeLookup.get(edge.target);

  // A hidden endpoint hides the edge (upstream parity, xyflow#5977): the
  // node's element is gone, so there is nothing to draw the edge to.
  if (!sourceNode || !targetNode || sourceNode.hidden || targetNode.hidden) {
    return null;
  }

  const edgePosition = getEdgePosition({
    id: edge.id,
    sourceNode,
    targetNode,
    sourceHandle: edge.sourceHandle || null,
    targetHandle: edge.targetHandle || null,
    connectionMode: settings.connectionMode as ConnectionMode,
    onError: settings.onError,
  });

  if (!edgePosition) return null;

  const selected = joinSelected(edge.selected, overlayEntry(source.selectionOverlay, edge.id));

  return {
    ...settings.defaultEdgeOptions,
    ...edge,
    selected,
    ...edgePosition,
    // The edge's OWN z only: the endpoint part (a selected or child node's
    // z) is added where the z is drawn (edgeEndpointZ), so a node selection
    // does not re-run this row, geometry included (bench round 65).
    zIndex: edgeOwnZ(
      edge.zIndex ?? settings.defaultEdgeOptions.zIndex ?? 0,
      selected,
      settings.elevateEdgesOnSelect,
      settings.zIndexMode,
    ),
    sourceNode,
    targetNode,
    edge,
  };
};

/**
 * The edge's own part of xyflow's getElevatedEdgeZIndex: its zIndex, raised
 * by its own selection when edges elevate on select.
 */
const edgeOwnZ = (zIndex: number, selected: boolean, elevate: boolean, mode?: ZIndexMode) =>
  mode === "manual" ? zIndex : elevate && selected ? zIndex + 1000 : zIndex;

/**
 * The endpoint part of xyflow's getElevatedEdgeZIndex: a child node's z, or
 * a selected node's elevated z when edges elevate on select. Added to the
 * row's own z where the z is drawn (EdgeWrapper, EdgeLabel); the drawn value
 * is upstream's.
 */
export const edgeEndpointZ = (
  edge: Pick<ResolvedEdge, "source" | "target">,
  nodeLookup: Pick<Map<string, InternalNode>, "get">,
  elevate: boolean,
  mode?: ZIndexMode,
): number => {
  if (mode === "manual") return 0;
  const nodeZ = (id: string) => {
    const node = nodeLookup.get(id);
    return node && (node.parentId || (elevate && node.selected)) ? (node.internals.z ?? 0) : 0;
  };
  return Math.max(nodeZ(edge.source), nodeZ(edge.target));
};
