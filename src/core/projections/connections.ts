import type { HandleConnection, HandleType } from "@xyflow/system";
import { createProjection } from "solid-js";

import type { Edge } from "~/types";

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
export const createConnections = <EdgeType extends Edge = Edge>(
  source: ConnectionsSource<EdgeType>,
): ConnectionsRecord => {
  return createProjection<ConnectionsRecord>(
    () => {
      const out: ConnectionsRecord = {};

      const add = (key: string, entry: string, connection: HandleConnection) => {
        (out[key] ??= {})[entry] = connection;
      };

      for (const edge of source.edges) {
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

        add(edge.source, targetKey, connection);
        add(connectionKey(edge.source, "source"), targetKey, connection);
        if (sourceHandle) {
          add(connectionKey(edge.source, "source", sourceHandle), targetKey, connection);
        }

        add(edge.target, sourceKey, connection);
        add(connectionKey(edge.target, "target"), sourceKey, connection);
        if (targetHandle) {
          add(connectionKey(edge.target, "target", targetHandle), sourceKey, connection);
        }
      }

      return out;
    },
    {},
    { key: "id" },
  );
};
