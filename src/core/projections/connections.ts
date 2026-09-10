import type { HandleConnection, HandleType } from "@xyflow/system";
import { createMemo, createProjection, mapArray } from "solid-js";

import type { Edge } from "@/types";

/**
 * Lookup keys for the connection index. Each edge is registered under six
 * keys — for both of its endpoints: the node, the node+handle-type, and (when
 * a handle id is present) the node+type+handle:
 *   `${nodeId}` · `${nodeId}-${type}` · `${nodeId}-${type}-${handleId}`
 */
export const connectionKey = (
  nodeId: string,
  type?: HandleType,
  handleId?: string | null,
): string => `${nodeId}${type ? (handleId ? `-${type}-${handleId}` : `-${type}`) : ""}`;

/** connection-entry key: identifies one edge's connection pairing */
const pairKey = (
  aNode: string,
  aHandle: string | null,
  bNode: string,
  bHandle: string | null,
): string => `${aNode}-${aHandle}--${bNode}-${bHandle}`;

/** The connections index: a handle's `connectionKey` mapped to its live `HandleConnection`s. */
export type ConnectionsRecord = Record<string, Record<string, HandleConnection>>;

export type ConnectionsSource<EdgeType extends Edge = Edge> = {
  readonly edges: readonly EdgeType[];
};

/**
 * Connection index: user edges → nested record projection
 * (lookupKey → pairKey → HandleConnection).
 *
 * Derived by construction — this replaces the imperative
 * add/removeConnectionFromLookup pipeline (and with it, the entire
 * mutation-visibility bug class those helpers had: there is no write side
 * left). Nested-record reconciliation keeps the per-key sub-records
 * identity-stable, and their key structure is the reactive identity of a
 * handle's connection set: subscribers read `Object.keys(rec)` (or values)
 * and only re-run when THEIR key set changes.
 */
type Contribution = {
  readonly key: string;
  readonly entry: string;
  readonly connection: HandleConnection;
};

const sameContributions = (a: readonly Contribution[], b: readonly Contribution[]) =>
  a.length === b.length &&
  a.every((c, i) => {
    const o = b[i]!;
    return (
      c.key === o.key &&
      c.entry === o.entry &&
      c.connection.source === o.connection.source &&
      c.connection.target === o.connection.target &&
      c.connection.sourceHandle === o.connection.sourceHandle &&
      c.connection.targetHandle === o.connection.targetHandle
    );
  });

/** One edge's (up to six) index entries — reads only that edge's leaves. */
const edgeContributions = (edge: Edge): Contribution[] => {
  const sourceHandle = edge.sourceHandle ?? null;
  const targetHandle = edge.targetHandle ?? null;
  const connection: HandleConnection = {
    edgeId: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle,
    targetHandle,
  };
  const sourceKey = pairKey(edge.source, sourceHandle, edge.target, targetHandle);
  const targetKey = pairKey(edge.target, targetHandle, edge.source, sourceHandle);
  const out: Contribution[] = [
    { key: edge.source, entry: targetKey, connection },
    { key: connectionKey(edge.source, "source"), entry: targetKey, connection },
  ];
  if (sourceHandle) {
    out.push({
      key: connectionKey(edge.source, "source", sourceHandle),
      entry: targetKey,
      connection,
    });
  }
  out.push(
    { key: edge.target, entry: sourceKey, connection },
    { key: connectionKey(edge.target, "target"), entry: sourceKey, connection },
  );
  if (targetHandle) {
    out.push({
      key: connectionKey(edge.target, "target", targetHandle),
      entry: sourceKey,
      connection,
    });
  }
  return out;
};

export const createConnections = <EdgeType extends Edge = Edge>(
  source: ConnectionsSource<EdgeType>,
): ConnectionsRecord => {
  // Per-edge row derivations (rc.7 HUGE_FAN_IN, bench round 16): the record
  // used to read ~6 leaves of EVERY edge — one reconnect re-read the whole
  // graph (~5.4k sources @900 edges, ~60k @10k). Each row memo tracks only
  // its own edge's leaves and is equality-cut on its contributions, so a
  // field write re-runs one row; the record merge reads E memos, no leaves.
  const rows = createMemo(
    mapArray(
      () => source.edges,
      (edge) =>
        createMemo(() => edgeContributions(edge), {
          equals: sameContributions,
          name: "connections.row",
        }),
    ),
    { name: "connections.rows" },
  );

  return createProjection<ConnectionsRecord>(
    () => {
      const out: ConnectionsRecord = {};
      for (const row of rows()) {
        for (const { key, entry, connection } of row()) {
          (out[key] ??= {})[entry] = connection;
        }
      }
      return out;
    },
    {},
    { key: "id", name: "connections" },
  );
};
