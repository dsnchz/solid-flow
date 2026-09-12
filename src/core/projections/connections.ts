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

  // Draft-form, incremental (bench round 24): the return-value form rebuilt a
  // fresh ~20k-key record on EVERY edge change and the engine reconciled and
  // cloned it (~30 of the 34 ms per reconnect @10k). Now the derive still
  // reads every row memo (each is equality-cut, so an unchanged row returns
  // the SAME array), but only rows whose contributions changed touch the
  // draft: their old entries are removed, the new ones added.
  const prevByRow = new WeakMap<() => Contribution[], readonly Contribution[]>();
  let prevRows: ReadonlySet<() => Contribution[]> = new Set();

  // An emptied handle key is removed right away. (Until solid-js rc.8 a
  // root-level write in a projection derive cloned the whole root raw — 20k
  // keys @10k, ~13 ms — so emptied keys were kept and pruned lazily; rc.8's
  // overlay path makes the root delete O(1): solidjs/solid#3352.)
  const remove = (draft: ConnectionsRecord, list: readonly Contribution[]) => {
    for (const { key, entry, connection } of list) {
      const rec = draft[key];
      if (!rec || rec[entry]?.edgeId !== connection.edgeId) continue;
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed draft removal
      delete rec[entry];
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed draft removal
      if (Object.keys(rec).length === 0) delete draft[key];
    }
  };
  const add = (draft: ConnectionsRecord, list: readonly Contribution[]) => {
    for (const { key, entry, connection } of list) {
      const rec = (draft[key] ??= {});
      rec[entry] = connection;
    }
  };

  return createProjection<ConnectionsRecord>(
    (draft) => {
      // Removals first, adds last: a reset that recreates a row (same edge id,
      // same pair keys) must not have its fresh entries removed by the stale
      // row's cleanup.
      const seen = new Set<() => Contribution[]>();
      const changed: [() => Contribution[], readonly Contribution[]][] = [];
      for (const row of rows()) {
        seen.add(row);
        const next = row();
        const prev = prevByRow.get(row);
        if (prev === next) continue;
        if (prev) remove(draft, prev);
        changed.push([row, next]);
      }
      for (const row of prevRows) {
        if (seen.has(row)) continue;
        const prev = prevByRow.get(row);
        if (prev) remove(draft, prev);
        prevByRow.delete(row);
      }
      for (const [row, next] of changed) {
        add(draft, next);
        prevByRow.set(row, next);
      }
      prevRows = seen;
    },
    {},
    { key: null, name: "connections" },
  );
};
