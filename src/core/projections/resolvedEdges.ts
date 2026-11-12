import {
  type ConnectionMode,
  getEdgePosition,
  type OnError,
  type ZIndexMode,
} from "@xyflow/system";
import { createMemo, createProjection, getOwner, mapArray, onCleanup, untrack } from "solid-js";

import type { DefaultEdgeOptions, Edge, InternalNode, Node, ResolvedEdge } from "@/types";

import { edgePinned } from "../culling";
import { joinSelected, overlayEntry, type SelectionOverlay } from "../selectionOverlay";
import type { EdgeMarkers } from "./markers";
import { createEntryHolders, createRecordFacade, RowEntry } from "./rowRecord";

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
  /**
   * A node's endpoint version (internalNodes' EndpointVersions): changes
   * whenever anything an edge draws from the node does. Read tracked, then
   * the endpoints' geometry untracked.
   */
  readonly endpointVersion: (nodeId: string) => number | undefined;
  /**
   * Called with the edge's endpoint ids on every run, null when the edge is
   * gone: edge culling boxes the endpoints' node rects (see edgeBoxes.ts),
   * which needs no edge row.
   */
  readonly reportEndpoints?: (id: string, endpoints: EdgeEndpoints | null) => void;
  /**
   * Called with whether the edge is selected (overlay joined), resolved or
   * not, on every run; `false` when it is removed (the flow's selected-edges
   * record, projections/reportedIds.ts).
   */
  readonly reportSelected?: (id: string, selected: boolean) => void;
  /** The flow's edge markers (markers.ts): each edge reports its own two, on every run. */
  readonly markers?: Pick<EdgeMarkers, "set" | "remove">;
  /**
   * Called with whether the edge is pinned (edgePinned: never culled for a
   * reason of its own) on every run, and with `false` when it is removed.
   */
  readonly reportCullPin?: (id: string, pinned: boolean) => void;
  /**
   * Reactive, read when an edge is created (untracked): edge rows start COLD
   * and are created on first read (#22; see InternalNodesSource.lazyRows).
   */
  readonly lazyRows?: boolean;
};

/** An edge's endpoint node ids. */
export type EdgeEndpoints = { readonly source: string; readonly target: string };

type EdgeStore<EdgeType extends Edge> = { row: ResolvedEdge<EdgeType> | null };

/**
 * Edge layout join: user edges × internal nodes → screen-space edge geometry,
 * decomposed into SUB-STORES (spike 13): each edge is its own keyed
 * projection holding `{ row }` — the resolved row, or null while the edge
 * does not resolve (an endpoint missing or hidden, or a handle not found) —
 * and the record is a SHALLOW projection holding one holder per edge.
 *
 * Reads chain: `record[id].sourceX` goes through the shallow slot into the
 * edge's own store, so every materialized leaf signal hangs off its EDGE's
 * computed (defeating rc.1's per-update companion walk — see
 * internalNodes.ts). The edge projection tracks exactly what the join reads —
 * the edge's props and its endpoints' endpoint versions — so one node move
 * re-runs only the adjacent edges' projections; the record computed re-runs
 * only when membership changes.
 *
 * The viewport never participates here: culling decides from the
 * endpoints' node rects (edgeBoxes.ts), so panning never touches edge rows.
 *
 * Every edge has a key; `record[id]` is undefined while the edge does not
 * resolve. With `lazyRows` an edge row is created on its first read (#22):
 * until then a small memo reports its endpoints and cull pin, all culling
 * needs, and its endpoint nodes stay cold too.
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
  const entries = mapArray(
    () => source.edges,
    (edgeAccessor) => {
      const id = edgeAccessor().id;
      let endpoints: EdgeEndpoints | null = null;
      const reportEndpoints = (edge: EdgeType) => {
        if (!source.reportEndpoints) return;
        if (endpoints?.source === edge.source && endpoints.target === edge.target) return;
        endpoints = { source: edge.source, target: edge.target };
        source.reportEndpoints(id, endpoints);
      };
      const createRow = (): EdgeStore<EdgeType> =>
        createProjection<EdgeStore<EdgeType>>(
          // the accessor tracks the item slot: a controlled array reset swaps
          // the edge object while THIS row store (keyed by id) survives, so
          // downstream subscriptions never strand on disposed stores
          () => {
            const edge = edgeAccessor();
            const row = buildRow(source, settings(), edge);
            reportEndpoints(edge);
            source.markers?.set(id, edge.markerStart, edge.markerEnd);
            source.reportSelected?.(
              id,
              row
                ? !!row.selected
                : joinSelected(edge.selected, overlayEntry(source.selectionOverlay, id)),
            );
            source.reportCullPin?.(id, !!row && edgePinned(row.selected, row.cullable));
            return { row };
          },
          { row: null },
          { key: "id", name: "resolvedEdges.row" },
        );
      const entry = new RowEntry(id, edgeAccessor, getOwner(), createRow);
      onCleanup(() => {
        if (endpoints) source.reportEndpoints?.(id, null);
        source.reportSelected?.(id, false);
        source.markers?.remove(id);
        source.reportCullPin?.(id, false);
      });
      if (!untrack(() => source.lazyRows)) {
        void entry.store;
        return entry;
      }
      // Cold: what culling needs, without the row (see createInternalNodes).
      // eslint-disable-next-line solid/reactivity -- a memo nobody reads: it reports to the plain feeds, like the row derive
      createMemo(
        () => {
          if (entry.created) return;
          const edge = edgeAccessor();
          reportEndpoints(edge);
          source.markers?.set(id, edge.markerStart, edge.markerEnd);
          const selected = joinSelected(edge.selected, overlayEntry(source.selectionOverlay, id));
          source.reportCullPin?.(id, edgePinned(selected, edge.cullable));
          source.reportSelected?.(id, selected);
        },
        { name: "resolvedEdges.cold" },
      );
      return entry;
    },
    { keyed: (edge) => edge.id },
  );

  return createRecordFacade(
    createEntryHolders<
      ResolvedEdge<EdgeType>,
      EdgeStore<EdgeType>,
      RowEntry<EdgeType, EdgeStore<EdgeType>>
    >(entries, "resolvedEdges"),
  );
};

/**
 * An endpoint as @xyflow/system's getEdgePosition needs it. Without measured
 * handle bounds that helper falls back to the node's declared `handles` and
 * WRITES into each handle object (toHandleBounds: `width`/`height` default
 * to 1). A row store ignores those writes, so a handle declared without a
 * size stayed unsized and the edge's coordinates came out NaN. Before
 * measurement the helper gets plain copies of the declared handles to write
 * into; once handle bounds are measured it reads those and the node goes
 * through as is.
 */
const withWritableHandles = <NodeType extends Node>(
  node: InternalNode<NodeType>,
): InternalNode<NodeType> => {
  const handles = node.handles;
  if (node.internals.handleBounds || !handles?.length) return node;
  return { ...node, handles: handles.map((handle) => ({ ...handle })) };
};

type EdgeSettings = Pick<
  ResolvedEdgesSource,
  "connectionMode" | "defaultEdgeOptions" | "elevateEdgesOnSelect" | "zIndexMode" | "onError"
>;

const buildRow = <NodeType extends Node, EdgeType extends Edge>(
  source: Pick<
    ResolvedEdgesSource<NodeType, EdgeType>,
    "nodeLookup" | "selectionOverlay" | "endpointVersion"
  >,
  settings: EdgeSettings,
  edge: EdgeType,
): ResolvedEdge<EdgeType> | null => {
  // Every field read once: each read of the user's edge is a source of the
  // row, and the fields below were each read twice (here and in the spread).
  // The spread also subscribes to the edge's key set, so a field added later
  // re-runs the row.
  const fields = { ...edge };
  const sourceNode = source.nodeLookup.get(fields.source);
  const targetNode = source.nodeLookup.get(fields.target);

  // A hidden endpoint hides the edge (upstream parity, xyflow#5977): the
  // node's element is gone, so there is nothing to draw the edge to.
  if (!sourceNode || !targetNode || sourceNode.hidden || targetNode.hidden) {
    return null;
  }

  // The endpoints' geometry (position, size, handles) is a dozen leaves of
  // each node: subscribe to each node's endpoint version instead, and read
  // the geometry untracked (the dev runtime's WIDE_SCOPE_DEPS flagged every
  // edge at ~35 sources).
  source.endpointVersion(fields.source);
  source.endpointVersion(fields.target);
  const edgePosition = untrack(() =>
    getEdgePosition({
      id: fields.id,
      sourceNode: withWritableHandles(sourceNode),
      targetNode: withWritableHandles(targetNode),
      sourceHandle: fields.sourceHandle || null,
      targetHandle: fields.targetHandle || null,
      connectionMode: settings.connectionMode as ConnectionMode,
      onError: settings.onError,
    }),
  );

  if (!edgePosition) return null;

  const selected = joinSelected(fields.selected, overlayEntry(source.selectionOverlay, fields.id));

  return {
    ...settings.defaultEdgeOptions,
    ...fields,
    selected,
    ...edgePosition,
    // The edge's OWN z only: the endpoint part (a selected or child node's
    // z) is each node row's `edgeZ`, added where the z is drawn, so a node
    // selection does not re-run this row, geometry included (bench round 65).
    zIndex: edgeOwnZ(
      fields.zIndex ?? settings.defaultEdgeOptions.zIndex ?? 0,
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
 * by its own selection when edges elevate on select. The endpoint part is
 * internalNodes' edgeZOf.
 */
const edgeOwnZ = (zIndex: number, selected: boolean, elevate: boolean, mode?: ZIndexMode) =>
  mode === "manual" ? zIndex : elevate && selected ? zIndex + 1000 : zIndex;
