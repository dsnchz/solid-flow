import type { Handle, NodeDimensionChange, NodePositionChange } from "@xyflow/system";
import { createEffect, type StoreSetter } from "solid-js";

import type { Node } from "@/types";

import type { NodeMeasurements, NodeMeasurementWrite } from "./projections/internalNodes";
import type { RowIndex } from "./rowIndex";

export type MeasurementIngestDeps<NodeType extends Node> = {
  readonly setMeasurementsStore: StoreSetter<NodeMeasurements>;
  readonly setNodesStore: StoreSetter<NodeType[]>;
  /** Membership-cadence id list (visibleNodeIds), for the garbage-collection effect. */
  readonly nodeIds: () => readonly string[];
  /** O(1) id → draft row resolution (see core/rowIndex.ts). */
  readonly nodeIndex: RowIndex<NodeType>;
};

const handleListEqual = (a: readonly Handle[] | null, b: readonly Handle[] | null): boolean => {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!;
    const q = b[i]!;
    if (
      p.id !== q.id ||
      p.type !== q.type ||
      p.nodeId !== q.nodeId ||
      p.position !== q.position ||
      p.x !== q.x ||
      p.y !== q.y ||
      p.width !== q.width ||
      p.height !== q.height
    ) {
      return false;
    }
  }
  return true;
};

/**
 * A handle list is immutable: frozen objects are not wrappable, so every
 * store serves it RAW by identity, and a row write of the same list is a
 * no-op.
 */
const freezeHandles = (list: Handle[] | null): Handle[] | null => {
  if (list === null) return null;
  for (const handle of list) Object.freeze(handle);
  Object.freeze(list);
  return list;
};

/** The stored list when it equals the pass's fresh one, else the fresh one frozen. */
const nextHandles = (stored: Handle[] | null | undefined, next: Handle[] | null) =>
  stored !== undefined && handleListEqual(stored, next) ? stored : freezeHandles(next);

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
  nodeIds,
  nodeIndex,
}: MeasurementIngestDeps<NodeType>) => {
  /** Applies a DOM measuring pass's writes to the measurements root. */
  const applyMeasurementWrites = (writes: NodeMeasurementWrite[]) => {
    setMeasurementsStore((draft) => {
      for (const write of writes) {
        const entry = draft[write.id];
        if (write.hidden) {
          // Clear the handles (keep dimensions) so unhiding re-measures.
          if (entry) {
            entry.handleSource = undefined;
            entry.handleTarget = undefined;
          }
        } else if (entry === undefined) {
          draft[write.id] = {
            measured: write.measured,
            handleSource: freezeHandles(write.handleBounds.source),
            handleTarget: freezeHandles(write.handleBounds.target),
          };
        } else {
          // Leaf writes into the existing entry: an equal leaf is a no-op for
          // the store, so a pass that reports what is already there (a
          // ResizeObserver tick, a forced updateNodeInternals) notifies no
          // row and no edge (bench round 34).
          entry.measured.width = write.measured.width;
          entry.measured.height = write.measured.height;
          entry.handleSource = nextHandles(entry.handleSource, write.handleBounds.source);
          entry.handleTarget = nextHandles(entry.handleTarget, write.handleBounds.target);
        }
      }
      return undefined;
    });
  };

  /** Applies measured dimension/position changes back to the user graph. */
  const applyNodeChanges = (changes: (NodeDimensionChange | NodePositionChange)[]) => {
    if (changes.length === 0) return;

    setNodesStore((nodes) => {
      // Applied in order: parent expansion can emit BOTH a position and a
      // dimensions change for the same node, and both must land. Rows resolve
      // by index — a per-batch Map over the draft walked every row (a
      // NodeResizer frame is one change against 10k rows).
      for (const change of changes) {
        const node = nodeIndex.get(nodes, change.id);
        if (!node) continue;

        switch (change.type) {
          case "dimensions": {
            if (change.setAttributes) {
              node.width = change.dimensions?.width ?? node.width;
              node.height = change.dimensions?.height ?? node.height;
            }

            // Leaf writes into the seeded `measured` object (a replaced slot
            // would rebuild the row — the row projection's user snapshot
            // tracks slots and keys, not leaves; core/nodeSeed.ts). A row
            // from a raw user store lacks the key and gets it here, once.
            if (node.measured === undefined) {
              node.measured = { ...change.dimensions };
            } else if (change.dimensions) {
              node.measured.width = change.dimensions.width;
              node.measured.height = change.dimensions.height;
            }
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
  // so the shared membership-cadence id list is the only source this needs
  // (reading every row's id slot here duplicated visibleNodeIds' ~2n
  // subscriptions — rc.7 HUGE_FAN_IN).
  createEffect(
    () => new Set(nodeIds()),
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
    { name: "measurementsGC" },
  );

  return { applyMeasurementWrites, applyNodeChanges } as const;
};
