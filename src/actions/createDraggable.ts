import { type OnDrag, XYDrag } from "@xyflow/system";
import { type Accessor, createEffect, createSignal } from "solid-js";

import { useInternalSolidFlow } from "@/contexts/flow";
import { SubsetMapView } from "@/core/subsetMapView";

import type { Node } from "../types";

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
  const { store, nodeLookup, selectedNodeIds, actions } = useInternalSolidFlow();
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
        getStoreItems: () => {
          return {
            nodes: store.nodes,
            nodeLookup: dragLookup,
            edges: store.edges,
            nodeExtent: store.nodeExtent,
            snapGrid: store.snapGrid ?? [0, 0],
            snapToGrid: !!store.snapGrid,
            autoPanSpeed: store.autoPanSpeed,
            nodeOrigin: store.nodeOrigin,
            multiSelectionActive: store.multiselectionKeyPressed,
            domNode: store.domNode,
            transform: store.transform,
            autoPanOnNodeDrag: store.autoPanOnNodeDrag,
            nodesDraggable: store.nodesDraggable,
            selectNodesOnDrag: store.selectNodesOnDrag,
            nodeDragThreshold: store.nodeDragThreshold,
            unselectNodesAndEdges: actions.unselectNodesAndEdges,
            updateNodePositions: actions.updateNodePositions,
            panBy: actions.panBy,
            // Store arrays are readonly in 2.0; XYDrag's StoreItems expects mutable
          } as unknown as ReturnType<Parameters<typeof XYDrag<Node>>[0]["getStoreItems"]>;
        },
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
