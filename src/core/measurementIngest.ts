import type { NodeDimensionChange, NodePositionChange } from "@xyflow/system";
import { createEffect, type StoreSetter } from "solid-js";

import type { Node } from "@/types";

import type { NodeMeasurements, NodeMeasurementWrite } from "./projections/internalNodes";

export type MeasurementIngestDeps<NodeType extends Node> = {
  readonly setMeasurementsStore: StoreSetter<NodeMeasurements>;
  readonly setNodesStore: StoreSetter<NodeType[]>;
  /** Live view of the user graph, for the garbage-collection effect. */
  readonly nodes: () => readonly NodeType[];
};

/**
 * The measurement ingest lifecycle (WP3): everything that flows FROM the DOM
 * measuring pass INTO the data graph, plus the garbage collection that keeps
 * the measurements root aligned with graph membership. The DOM side (resize
 * observers, the idle-scheduled measuring pass) lives in createSolidFlow;
 * headless usage never calls these.
 */
export const createMeasurementIngest = <NodeType extends Node>({
  setMeasurementsStore,
  setNodesStore,
  nodes,
}: MeasurementIngestDeps<NodeType>) => {
  /** Applies a DOM measuring pass's writes to the measurements root. */
  const applyMeasurementWrites = (writes: NodeMeasurementWrite[]) => {
    setMeasurementsStore((draft) => {
      for (const write of writes) {
        if (write.hidden) {
          // Clear handle bounds (keep dimensions) so unhiding re-measures.
          const entry = draft[write.id];
          if (entry) entry.handleBounds = undefined;
        } else {
          draft[write.id] = { measured: write.measured, handleBounds: write.handleBounds };
        }
      }
      return undefined;
    });
  };

  /** Applies measured dimension/position changes back to the user graph. */
  const applyNodeChanges = (changes: (NodeDimensionChange | NodePositionChange)[]) => {
    if (changes.length === 0) return;

    setNodesStore((nodes) => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

      // Applied in order: parent expansion can emit BOTH a position and a
      // dimensions change for the same node, and both must land.
      for (const change of changes) {
        const node = nodeById.get(change.id);
        if (!node) continue;

        switch (change.type) {
          case "dimensions": {
            if (change.setAttributes) {
              node.width = change.dimensions?.width ?? node.width;
              node.height = change.dimensions?.height ?? node.height;
            }

            node.measured = { ...node.measured, ...change.dimensions };
            break;
          }
          case "position":
            node.position = change.position ?? node.position;
            break;
        }
      }
      return undefined;
    });
  };

  // Garbage-collect measurements for nodes that no longer exist in the user
  // graph. Entries only appear via the measurement ingest, keyed by node id,
  // so tracking the node ids is sufficient.
  createEffect(
    () => new Set(nodes().map((n) => n.id)),
    (currentIds) => {
      setMeasurementsStore((draft) => {
        for (const id of Object.keys(draft)) {
          if (!currentIds.has(id)) {
            // `delete` is required: unlike the 1.x path setter, assigning
            // undefined in a 2.0 draft KEEPS the own key — visible to `in`
            // guards and Object.keys, and skips structural notification
            // (spike 09).
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
            delete draft[id];
          }
        }
        return undefined;
      });
    },
  );

  return { applyMeasurementWrites, applyNodeChanges } as const;
};
