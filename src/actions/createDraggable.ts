import { type OnDrag, XYDrag } from "@xyflow/system";
import { type Accessor, createEffect, createSignal } from "solid-js";

import { useInternalSolidFlow } from "../components/contexts/flow";
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
  const { store, nodeLookup, actions } = useInternalSolidFlow();
  const [dragging, setDragging] = createSignal(false);

  // Mount the drag controller on the element (external system: XYDrag/d3-drag)
  createEffect(
    () => ({ el: elem(), current: params() }),
    ({ el, current }) => {
      if (!el || current.disabled) return;

      const { onDrag, onDragStart, onDragStop, onNodeMouseDown } = current;

      const dragInstance = XYDrag<Node>({
        onDrag,
        onDragStart: (event, dragItems, node, nodes) => {
          setDragging(true);
          onDragStart?.(event, dragItems, node, nodes);
        },
        onDragStop: (event, dragItems, node, nodes) => {
          setDragging(false);
          onDragStop?.(event, dragItems, node, nodes);
        },
        onNodeMouseDown,
        getStoreItems: () => {
          return {
            nodes: store.nodes,
            nodeLookup,
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
  );

  return dragging;
};

export default createDraggable;
