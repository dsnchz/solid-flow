import { type EdgeChange, EdgeChangeset, type NodeChange, NodeChangeset } from "@xyflow/system";
import { untrack } from "solid-js";

import type { Edge, Node, OnEdgesChange, OnNodesChange } from "@/types";

/**
 * One axis of `onNodesChange` / `onEdgesChange` (Svelte Flow 2's
 * `onnodeschange` / `onedgeschange`). The flow's writers ask `active()`
 * once per call: unset, they write as they always did; set, they describe
 * the write as changes, the callback edits the changeset, and `apply`
 * writes what is left through the same row writers.
 */
export type ChangeQueue<Change> = {
  /** Whether the callback is set (the writers branch on it once per call). */
  readonly active: () => boolean;
  /** Gesture and measurement writes: batched for the end of the task. */
  readonly queue: (changes: readonly Change[]) => void;
  /** Command writes: delivered now, after anything queued (actions stay atomic). */
  readonly deliver: (changes: readonly Change[]) => void;
  /** Delivers what is queued now: gesture boundaries that read state back. */
  readonly flush: () => void;
};

type Changeset<Change> = {
  add(change: Change[]): void;
  isEmpty(): boolean;
};

const createChangeQueue = <Change, Set extends Changeset<Change>>(
  callback: () => ((changes: Set) => void) | undefined,
  createSet: () => Set,
  apply: (changes: Set) => void,
): ChangeQueue<Change> => {
  let pending: Set | undefined;

  const flush = () => {
    const changes = pending;
    if (!changes) return;
    pending = undefined;
    // Untracked: a read in the callback must not subscribe the caller (a
    // command can run in a tracked scope).
    untrack(() => callback()?.(changes));
    if (!changes.isEmpty()) apply(changes);
  };

  const queue = (changes: readonly Change[]) => {
    if (changes.length === 0) return;
    if (!pending) {
      pending = createSet();
      queueMicrotask(flush);
    }
    pending.add(changes as Change[]);
  };

  return {
    active: () => callback() !== undefined,
    queue,
    deliver: (changes) => {
      flush();
      if (changes.length === 0) return;
      pending = createSet();
      pending.add(changes as Change[]);
      flush();
    },
    flush,
  };
};

/** The two axes, created before the writers and given their appliers after. */
export type FlowChanges<NodeType extends Node, EdgeType extends Edge> = {
  readonly nodes: ChangeQueue<NodeChange<NodeType>>;
  readonly edges: ChangeQueue<EdgeChange<EdgeType>>;
  /** Delivers both axes' queued changes now (see {@link ChangeQueue.flush}). */
  readonly flush: () => void;
  readonly setAppliers: (appliers: {
    nodes: (changes: NodeChangeset<NodeType>) => void;
    edges: (changes: EdgeChangeset<EdgeType>) => void;
  }) => void;
};

export const createFlowChanges = <NodeType extends Node, EdgeType extends Edge>(store: {
  readonly onNodesChange?: OnNodesChange<NodeType>;
  readonly onEdgesChange?: OnEdgesChange<EdgeType>;
}): FlowChanges<NodeType, EdgeType> => {
  let applyNodes: (changes: NodeChangeset<NodeType>) => void = () => {};
  let applyEdges: (changes: EdgeChangeset<EdgeType>) => void = () => {};

  const nodes = createChangeQueue<NodeChange<NodeType>, NodeChangeset<NodeType>>(
    () => store.onNodesChange,
    () => new NodeChangeset<NodeType>(),
    (changes) => applyNodes(changes),
  );
  const edges = createChangeQueue<EdgeChange<EdgeType>, EdgeChangeset<EdgeType>>(
    () => store.onEdgesChange,
    () => new EdgeChangeset<EdgeType>(),
    (changes) => applyEdges(changes),
  );

  return {
    nodes,
    edges,
    flush: () => {
      nodes.flush();
      edges.flush();
    },
    setAppliers: (appliers) => {
      applyNodes = appliers.nodes;
      applyEdges = appliers.edges;
    },
  };
};
