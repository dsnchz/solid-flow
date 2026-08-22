import {
  type ConnectionMode,
  getEdgePosition,
  getElevatedEdgeZIndex,
  isEdgeVisible,
  type OnError,
  type Transform,
  type ZIndexMode,
} from "@xyflow/system";
import { createMemo, createProjection, mapArray } from "solid-js";

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
  readonly nodeLookup: Pick<Map<string, InternalNode<NodeType>>, "get">;
};

/**
 * Edge layout join: user edges × internal nodes → screen-space edge geometry,
 * as an id-keyed record projection. Keyed reconciliation preserves row
 * identity across derive re-runs, so downstream per-edge subscribers only
 * re-run when their own row's leaves change.
 *
 * Each row is its own memo (spike 10, strategy D): the memo tracks exactly
 * what the join reads — the edge's props and its endpoints' geometry leaves
 * through nodeLookup — so one node move re-runs only the adjacent edges'
 * memos, and the projection derive just reads E memo values. Unchanged rows
 * keep their previous OBJECT, which the keyed reconcile skips by identity:
 * one node move costs O(adjacent edges), not O(E).
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
  const rowMemos = mapArray(
    () => source.edges,
    (edge) => {
      const memo = createMemo((): EdgeLayouted<EdgeType> | null => buildRow(source, edge));
      return { edge, memo };
    },
  );

  return createProjection<Record<string, EdgeLayouted<EdgeType>>>(
    () => {
      const out: Record<string, EdgeLayouted<EdgeType>> = {};
      for (const { edge, memo } of rowMemos()) {
        const row = memo();
        if (row) out[edge.id] = row;
      }
      return out;
    },
    {},
    { key: "id" },
  );
};

const buildRow = <NodeType extends Node, EdgeType extends Edge>(
  source: LayoutedEdgesSource<NodeType, EdgeType>,
  edge: EdgeType,
): EdgeLayouted<EdgeType> | null => {
  const sourceNode = source.nodeLookup.get(edge.source);
  const targetNode = source.nodeLookup.get(edge.target);

  if (!sourceNode || !targetNode) return null;

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
