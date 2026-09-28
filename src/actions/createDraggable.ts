import { type OnDrag, XYDrag } from "@xyflow/system";
import { type Accessor, createEffect, createSignal } from "solid-js";

import { useInternalSolidFlow } from "@/contexts/flow";
import { SubsetMapView } from "@/core/subsetMapView";

import type { Node } from "../types";

type InternalFlow = ReturnType<typeof useInternalSolidFlow>;
type StoreItems = ReturnType<Parameters<typeof XYDrag<Node>>[0]["getStoreItems"]>;

/**
 * XYDrag calls `getStoreItems()` about five times per drag move (its drag
 * handler, `updateNodes`, and the auto-pan rAF loop) and destructures only
 * the four to nine fields each caller needs. A fresh 15-field object per call
 * read every field every time (bench rounds 49 and 53). Instead the fields
 * are getters on one object per flow, used as the prototype of each node's
 * items, so a call reads only what it destructures, at call time: every
 * value stays as live as before, nothing is snapshotted.
 */
const sharedStoreItems = new WeakMap<InternalFlow["store"], object>();
const storeItemsPrototype = ({ store, actions }: InternalFlow): object => {
  let items = sharedStoreItems.get(store);
  if (items === undefined) {
    items = {
      get nodes() {
        return store.nodes;
      },
      get edges() {
        return store.edges;
      },
      get nodeExtent() {
        return store.nodeExtent;
      },
      get snapGrid() {
        return store.snapGrid ?? [0, 0];
      },
      get snapToGrid() {
        return !!store.snapGrid;
      },
      get autoPanSpeed() {
        return store.autoPanSpeed;
      },
      get nodeOrigin() {
        return store.nodeOrigin;
      },
      get multiSelectionActive() {
        return store.multiselectionKeyPressed;
      },
      get domNode() {
        return store.domNode;
      },
      get transform() {
        return store.transform;
      },
      get autoPanOnNodeDrag() {
        return store.autoPanOnNodeDrag;
      },
      get nodesDraggable() {
        return store.nodesDraggable;
      },
      get selectNodesOnDrag() {
        return store.selectNodesOnDrag;
      },
      get nodeDragThreshold() {
        return store.nodeDragThreshold;
      },
      unselectNodesAndEdges: actions.unselectNodesAndEdges,
      updateNodePositions: actions.updateNodePositions,
      panBy: actions.panBy,
    };
    sharedStoreItems.set(store, items);
  }
  return items;
};

export type CreateDraggableParams = {
  readonly disabled: boolean;
  readonly noDragClass: string;
  readonly handleSelector: string;
  readonly nodeId: string;
  readonly isSelectable: boolean;
  readonly nodeClickDistance: number;
  readonly onDrag: OnDrag;
  readonly onDragStart: OnDrag;
  readonly onDragStop: OnDrag;
  readonly onNodeMouseDown: (id: string) => void;
};

const createDraggable = (
  elem: Accessor<HTMLElement | undefined>,
  params: Accessor<Partial<CreateDraggableParams>>,
) => {
  const flow = useInternalSolidFlow();
  const { nodeLookup, selectedNodeIds, actions } = flow;
  // Gesture-scoped lookup for XYDrag: its start scans the whole map to pick
  // the selected nodes and the dragged node (~19ms first frame @10k through
  // the record facade, bench round 22). Iteration yields only those
  // candidates; keyed reads (parents, deleted-while-dragging) still resolve
  // every node. Candidates are read when XYDrag iterates, at gesture start.
  let dragNodeId: string | undefined;
  const dragLookup = new SubsetMapView(nodeLookup, () => {
    const ids = Object.keys(selectedNodeIds);
    if (dragNodeId !== undefined && !(dragNodeId in selectedNodeIds)) ids.push(dragNodeId);
    return ids;
  });
  const [dragging, setDragging] = createSignal(false);
  // This node's items: the shared getters plus its own gesture lookup,
  // created on its first drag (a mount creates none).
  let storeItems: StoreItems | undefined;

  // Mount the drag controller on the element (external system: XYDrag/d3-drag)
  createEffect(
    () => ({ el: elem(), current: params() }),
    ({ el, current }) => {
      if (!el || current.disabled) return;

      const { onDrag, onDragStart, onDragStop, onNodeMouseDown } = current;
      dragNodeId = current.nodeId;

      const dragInstance = XYDrag<Node>({
        onDrag,
        onDragStart: (event, dragItems, node, nodes) => {
          setDragging(true);
          // Flow-level `dragging` (upstream parity): consumers such as the
          // minimap's per-frame bounds sampling key off the graph-wide flag,
          // which previously only pane drags (Zoom) ever set.
          actions.setDragging(true);
          onDragStart?.(event, dragItems, node, nodes);
        },
        onDragStop: (event, dragItems, node, nodes) => {
          setDragging(false);
          actions.setDragging(false);
          onDragStop?.(event, dragItems, node, nodes);
        },
        onNodeMouseDown,
        getStoreItems: () =>
          (storeItems ??= Object.create(storeItemsPrototype(flow), {
            nodeLookup: { value: dragLookup },
            // Store arrays are readonly in 2.0; XYDrag's StoreItems expects mutable
          }) as StoreItems),
      });

      dragInstance.update({
        domNode: el,
        nodeId: current.nodeId,
        noDragClassName: current.noDragClass,
        handleSelector: current.handleSelector,
        isSelectable: current.isSelectable,
        nodeClickDistance: current.nodeClickDistance,
      });

      return () => {
        dragInstance.destroy();
      };
    },
    { name: "draggable" },
  );

  return dragging;
};

export default createDraggable;
