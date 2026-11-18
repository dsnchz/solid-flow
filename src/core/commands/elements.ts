import {
  addChange,
  addEdge as systemAddEdge,
  type Connection,
  type EdgeChange,
  getElementsToRemove,
  type NodeChange,
  type NodeDragItem,
  type NodeLookup,
  removeChange,
  replaceChange,
  selectionChange,
  type Viewport,
  type XYPosition,
} from "@xyflow/system";
import { snapshot, type StoreSetter, untrack } from "solid-js";

import type { Edge, InternalNode, Node, OnBeforeDelete, OnDelete } from "@/types";

import type { FlowChanges } from "../changes";
import { type DragOverlay } from "../dragOverlay";
import type { FlowCommands } from "../flowState";
import { seedNodeRow } from "../nodeSeed";
import type { RowIndex } from "../rowIndex";
import { isEdge, isNode } from "../rules";
import { type SelectionOverlay } from "../selectionOverlay";

/** The slice of the internal store the element commands read. */
type ElementStoreReads<NodeType extends Node, EdgeType extends Edge> = {
  // Mutable array types: these mirror the internal store's getters, and
  // system helpers (getElementsToRemove) take mutable arrays.
  readonly nodes: NodeType[];
  readonly edges: EdgeType[];
  readonly viewport: Viewport;
  readonly onBeforeDelete?: OnBeforeDelete<NodeType, EdgeType>;
  readonly onNodesDelete?: (nodes: NodeType[]) => void;
  readonly onEdgesDelete?: (edges: EdgeType[]) => void;
  readonly onDelete?: OnDelete<NodeType, EdgeType>;
};

export type ElementCommandDeps<NodeType extends Node, EdgeType extends Edge> = {
  readonly store: ElementStoreReads<NodeType, EdgeType>;
  readonly setNodesStore: StoreSetter<NodeType[]>;
  readonly setEdgesStore: StoreSetter<EdgeType[]>;
  readonly setSelectionOverlay: StoreSetter<{ nodes: SelectionOverlay; edges: SelectionOverlay }>;
  readonly setDragOverlay: StoreSetter<DragOverlay>;
  readonly nodeLookup: NodeLookup<InternalNode<NodeType>>;
  /** O(1) id → draft row resolution (see core/rowIndex.ts). */
  readonly nodeIndex: RowIndex<NodeType>;
  readonly edgeIndex: RowIndex<EdgeType>;
  /** Whether the edges axis is controlled (the user's store owns membership). */
  readonly controlledEdges: () => boolean;
  /** onNodesChange / onEdgesChange routing (core/changes.ts). */
  readonly changes: FlowChanges<NodeType, EdgeType>;
};

/**
 * The changes an update describes, for onNodesChange / onEdgesChange: the
 * `position`, `data` and `select` changes plus an `update` with the other
 * keys that differ from the row (Svelte Flow 2's split; unchanged keys an
 * updater spreads through are left out). Selection follows updateNode's
 * routing rule: an updater's pass-through value is not a selection write.
 * A replacement is the caller's `replace` change.
 */
const describeUpdate = <T extends Node | Edge>(
  row: T,
  next: Partial<T>,
  isUpdater: boolean,
): (NodeChange<Node> | EdgeChange<Edge>)[] => {
  const id = row.id;
  const changes: (NodeChange<Node> | EdgeChange<Edge>)[] = [];
  const { position, data, selected, ...rest } = next as Partial<Node>;
  const current = row as Partial<Node>;
  if (position && (position.x !== current.position?.x || position.y !== current.position?.y)) {
    changes.push({ id, type: "position", position: { x: position.x, y: position.y } });
  }
  if (data !== undefined && data !== current.data) {
    changes.push({ id, type: "data", data, replace: true });
  }
  if (selected !== undefined && (!isUpdater || selected !== current.selected)) {
    changes.push(selectionChange(id, !!selected));
  }
  const item: Record<string, unknown> = {};
  let changed = false;
  for (const key of Object.keys(rest)) {
    const value = (rest as Record<string, unknown>)[key];
    if (value !== (row as Record<string, unknown>)[key]) {
      item[key] = value;
      changed = true;
    }
  }
  if (changed) changes.push({ id, type: "update", item });
  return changes;
};

/**
 * Element command group: every structural or field mutation of nodes and
 * edges (add, update, delete, serialize), plus the two gesture-driven
 * writers (connection completion, drag positions). All writes are draft
 * writes on the graph roots; flow-driven fields (`selected`, drag positions)
 * are ALSO routed through the sidecars so commands compose over optimistic
 * stores exactly like gestures do (#3085).
 */
export const createElementCommands = <NodeType extends Node, EdgeType extends Edge>({
  store,
  setNodesStore,
  setEdgesStore,
  setSelectionOverlay,
  setDragOverlay,
  nodeLookup,
  nodeIndex,
  edgeIndex,
  controlledEdges,
  changes,
}: ElementCommandDeps<NodeType, EdgeType>) => {
  const addEdge = (edgeParams: EdgeType | Connection) => {
    // Connection-completion writer (Handle's drag and click paths). On a
    // controlled edges axis membership belongs to the user's store: the
    // connection reaches them only through onConnect, and auto-inserting here
    // would pierce into their store and duplicate the documented adoption
    // push. Uncontrolled flows own membership, so the connection lands
    // directly.
    if (controlledEdges()) return;
    if (changes.edges.active()) {
      const edges = untrack(() => store.edges);
      const next = systemAddEdge(edgeParams, edges);
      if (next !== edges) changes.edges.queue([addChange(next[next.length - 1]!)]);
      return;
    }
    setEdgesStore((edges) => {
      const next = systemAddEdge(edgeParams, edges);
      // systemAddEdge returns the same array when the edge is invalid/duplicate
      if (next !== edges) {
        edges.push(next[next.length - 1]!);
      }
      return undefined;
    });
  };

  const updateNodePositions = (
    nodeDragItems: Map<string, Pick<NodeDragItem, "position">>,
    dragging = false,
  ) => {
    if (changes.nodes.active()) {
      const list: NodeChange<NodeType>[] = [];
      for (const [id, { position }] of nodeDragItems) {
        list.push({ id, type: "position", position: { x: position.x, y: position.y }, dragging });
      }
      changes.nodes.queue(list);
      return;
    }
    writeNodePositions(nodeDragItems, dragging);
  };

  const writeNodePositions = (
    nodeDragItems: Map<string, Pick<NodeDragItem, "position">>,
    dragging: boolean,
  ) => {
    // Overlay write (authoritative for rendering) + best-effort row
    // write-through (parity: a plain store is live during the drag).
    // rowBefore is captured from the row's PRE-write value on the gesture's
    // first frame and carried through subsequent frames.
    setNodesStore((nodes) => {
      const writes: {
        id: string;
        position: XYPosition;
        rowBefore: XYPosition;
        row: NodeType;
      }[] = [];
      // Resolve the k dragged rows by index — never walk the 10k-row draft
      // (each visited row cost an index-get trap plus an `id` trap per frame).
      for (const [id, { position }] of nodeDragItems) {
        const node = nodeIndex.get(nodes, id);
        if (!node) continue;
        writes.push({ id, position, rowBefore: { ...node.position }, row: node });
        node.dragging = dragging;
        // Leaf writes, not a slot swap (bench round 41): the row derive
        // tracks `position.x`/`y` directly and takes its leaf path, whereas a
        // replaced `position` object re-ran the row's user snapshot and a
        // full reconcile per moved node per frame (and is the engine's
        // IMMUTABLE_UPDATE_IN_STORE diagnostic).
        const rowPosition = node.position;
        rowPosition.x = position.x;
        rowPosition.y = position.y;
      }
      setDragOverlay((draft) => {
        for (const { id, position, rowBefore, row } of writes) {
          const entry = draft[id];
          if (entry !== undefined) {
            // Leaf writes into the entry, on every frame AND on the frame
            // that flips `dragging` (gesture start over an unreleased entry,
            // gesture end): a replaced entry re-runs every reader for the two
            // leaves that moved (the engine's IMMUTABLE_UPDATE_IN_STORE
            // diagnostic; bench round 41, the drag end found on the SSR
            // smoke page). `rowBefore` and the captured `row` carry over.
            const entryPosition = entry.position;
            entryPosition.x = position.x;
            entryPosition.y = position.y;
            if (entry.dragging !== dragging) entry.dragging = dragging;
          } else {
            draft[id] = {
              position: { x: position.x, y: position.y },
              dragging,
              rowBefore,
              row,
            };
          }
        }
      });
      return undefined;
    });
  };

  const writeNode: FlowCommands<NodeType, EdgeType>["updateNode"] = (
    id,
    nodeUpdate,
    options = { replace: false },
  ) => {
    setNodesStore((nodes) => {
      const index = nodeIndex.indexOf(nodes, id);
      if (index === -1) return undefined;

      const node = nodes[index]!;
      const nextNode = typeof nodeUpdate === "function" ? nodeUpdate(node) : nodeUpdate;
      // `selected` is flow state, not user data: route it through the
      // selection sidecar too, so updateNode-driven selection composes over
      // optimistic stores exactly like gesture-driven selection. The entry
      // holds the ORIGINAL row proxy, and `selected` is field-written onto it
      // BEFORE the slot replacement: on plain stores the field write commits
      // (entry confirms; the replacement row governs after release), on
      // optimistic stores both writes revert together and the overlay holds.
      // Capturing the replacement object instead would self-confirm — it
      // keeps the written value even after the slot reverts around it.
      //
      // Only an actual selection write routes: an object patch that carries
      // `selected`, or an updater whose result changed it from the row it was
      // handed. An updater that spreads the row (`n => ({ ...n, data })`,
      // updateNodeData) passes the row's own value through; on an optimistic
      // store that value can be a reverted `false` while the overlay holds
      // the selection, and routing it would deselect the node.
      if (
        nextNode.selected !== undefined &&
        (typeof nodeUpdate !== "function" || nextNode.selected !== node.selected)
      ) {
        node.selected = !!nextNode.selected;
        setSelectionOverlay((draft) => {
          draft.nodes[id] = { value: !!nextNode.selected, row: node };
        });
      }
      // Merge = FIELD writes into the draft row (not a slot replacement): a
      // replaced slot reads as a membership change to everything keyed on
      // row identity — the id lists, lookups and per-row mapArray rows all
      // re-derived for one updateNodeData (~78ms per write @10k, bench
      // round 17). Object.assign on the draft proxy is the spread's
      // semantics (own enumerable keys, undefined values included) as
      // per-key store writes; equal values do not notify.
      if (options?.replace && isNode<NodeType>(nextNode)) nodes[index] = nextNode;
      else Object.assign(node, nextNode);
      return undefined;
    });
  };

  const updateNode: FlowCommands<NodeType, EdgeType>["updateNode"] = (
    id,
    nodeUpdate,
    options = { replace: false },
  ) => {
    if (changes.nodes.active()) {
      const node = untrack(() => nodeIndex.get(store.nodes, id));
      if (!node) return;
      const isUpdater = typeof nodeUpdate === "function";
      const nextNode = isUpdater ? nodeUpdate(node) : nodeUpdate;
      changes.nodes.deliver(
        options?.replace && isNode<NodeType>(nextNode)
          ? [replaceChange(nextNode)]
          : (describeUpdate(node, nextNode, isUpdater) as NodeChange<NodeType>[]),
      );
      return;
    }
    writeNode(id, nodeUpdate, options);
  };

  const writeEdge: FlowCommands<NodeType, EdgeType>["updateEdge"] = (
    id,
    edgeUpdate,
    options = { replace: false },
  ) => {
    setEdgesStore((edges) => {
      const index = edgeIndex.indexOf(edges, id);
      if (index === -1) return undefined;

      const edge = edges[index]!;
      const nextEdge = typeof edgeUpdate === "function" ? edgeUpdate(edge) : edgeUpdate;
      // `selected` routing — see updateNode for the original-row-proxy
      // capture rationale and the pass-through rule.
      if (
        nextEdge.selected !== undefined &&
        (typeof edgeUpdate !== "function" || nextEdge.selected !== edge.selected)
      ) {
        edge.selected = !!nextEdge.selected;
        setSelectionOverlay((draft) => {
          draft.edges[id] = { value: !!nextEdge.selected, row: edge };
        });
      }
      // Field writes for the merge path — see updateNode.
      if (options.replace && isEdge<EdgeType>(nextEdge)) edges[index] = nextEdge;
      else Object.assign(edge, nextEdge);
      return undefined;
    });
  };

  /** Inserts at each change's `index` (applySelf order), else appends. */
  const insertRows = <T>(rows: readonly T[], added: readonly { item: T; index?: number }[]) => {
    const next = [...rows];
    for (const { item, index } of added) {
      if (index === undefined) next.push(item);
      else next.splice(index, 0, item);
    }
    return next;
  };

  /** The raw writers onNodesChange / onEdgesChange apply through (core/commands/applyChanges.ts). */
  const raw = {
    writeNodePositions,
    writeNode,
    writeEdge,
    insertNodes: (added: readonly { item: NodeType; index?: number }[]) => {
      // Seeded while still plain (see core/nodeSeed.ts).
      const seeded = added.map(({ item, index }) => ({ item: seedNodeRow(item), index }));
      setNodesStore((nodes) => insertRows(nodes, seeded));
    },
    insertEdges: (added: readonly { item: EdgeType; index?: number }[]) => {
      setEdgesStore((edges) => insertRows(edges, added));
    },
    removeNodes: (ids: ReadonlySet<string>) => {
      const remaining = store.nodes.filter((node) => !ids.has(node.id));
      setNodesStore(() => remaining);
    },
    removeEdges: (ids: ReadonlySet<string>) => {
      const remaining = store.edges.filter((edge) => !ids.has(edge.id));
      setEdgesStore(() => remaining);
    },
  } as const;

  const commands = {
    addNodes: (payload) => {
      const added = Array.isArray(payload) ? payload : [payload];
      if (changes.nodes.active()) {
        changes.nodes.deliver(added.map((node) => addChange(node)));
        return;
      }
      // Seeded while still plain (see core/nodeSeed.ts).
      const newNodes = added.map(seedNodeRow);
      setNodesStore((nodes) => [...nodes, ...newNodes]);
    },
    addEdges: (payload) => {
      const newEdges = Array.isArray(payload) ? payload : [payload];
      if (changes.edges.active()) {
        changes.edges.deliver(newEdges.map((edge) => addChange(edge)));
        return;
      }
      setEdgesStore((edges) => [...edges, ...newEdges]);
    },
    updateNode,
    updateNodeData: (id, dataUpdate, options) => {
      const node = nodeLookup.get(id)?.internals.userNode;
      if (!node) return;

      const nextData = typeof dataUpdate === "function" ? dataUpdate(node) : dataUpdate;
      if (changes.nodes.active()) {
        changes.nodes.deliver([
          options?.replace
            ? { id, type: "data", data: nextData as NodeType["data"], replace: true }
            : { id, type: "data", data: nextData, replace: false },
        ]);
        return;
      }
      writeNode(id, (current) => ({
        ...current,
        data: options?.replace ? nextData : { ...current.data, ...nextData },
      }));
    },
    updateEdge: (id, edgeUpdate, options = { replace: false }) => {
      if (changes.edges.active()) {
        const edge = untrack(() => edgeIndex.get(store.edges, id));
        if (!edge) return;
        const isUpdater = typeof edgeUpdate === "function";
        const nextEdge = isUpdater ? edgeUpdate(edge) : edgeUpdate;
        changes.edges.deliver(
          options.replace && isEdge<EdgeType>(nextEdge)
            ? [replaceChange(nextEdge)]
            : (describeUpdate(edge, nextEdge, isUpdater) as EdgeChange<EdgeType>[]),
        );
        return;
      }
      writeEdge(id, edgeUpdate, options);
    },
    deleteElements: async ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
      // @xyflow/system 1.0's getElementsToRemove walks the parent tree (any
      // array order) and matches nodes and edges through id sets, in linear
      // time over the graph.
      const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove<
        NodeType,
        EdgeType
      >({
        nodesToRemove,
        edgesToRemove,
        nodes: store.nodes,
        edges: store.edges,
        onBeforeDelete: store.onBeforeDelete,
      });

      // Id sets, not `matching.some(...)` per row: that was O(rows x deleted)
      // proxy reads (10k nodes, delete 1,000: 2.3 s).
      if (matchingEdges) {
        if (changes.edges.active()) {
          store.onEdgesDelete?.(matchingEdges);
          changes.edges.deliver(matchingEdges.map(({ id }) => removeChange(id)));
        } else {
          const deleted = new Set(matchingEdges.map(({ id }) => id));
          const remainingEdges = store.edges.filter((edge) => !deleted.has(edge.id));

          store.onEdgesDelete?.(matchingEdges);
          setEdgesStore(() => remainingEdges);
        }
      }

      if (matchingNodes) {
        if (changes.nodes.active()) {
          store.onNodesDelete?.(matchingNodes);
          changes.nodes.deliver(matchingNodes.map(({ id }) => removeChange(id)));
        } else {
          const deleted = new Set(matchingNodes.map(({ id }) => id));
          const remainingNodes = store.nodes.filter((node) => !deleted.has(node.id));

          store.onNodesDelete?.(matchingNodes);
          setNodesStore(() => remainingNodes);
        }
      }

      // Every delete path (keyboard AND programmatic) notifies here, so
      // commands.deleteElements never deletes silently.
      const deletedNodes = matchingNodes ?? [];
      const deletedEdges = matchingEdges ?? [];
      if (deletedNodes.length > 0 || deletedEdges.length > 0) {
        store.onDelete?.({ nodes: deletedNodes, edges: deletedEdges });
      }

      return {
        deletedNodes: matchingNodes,
        deletedEdges: matchingEdges,
      };
    },
    toObject: () => {
      return structuredClone({
        nodes: [...snapshot(store.nodes)],
        edges: [...snapshot(store.edges)],
        viewport: { ...snapshot(store.viewport) },
      });
    },
  } satisfies Partial<FlowCommands<NodeType, EdgeType>>;

  return { ...commands, addEdge, updateNodePositions, raw } as const;
};
