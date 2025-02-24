import type { XYDragInstance } from "@xyflow/system";
import { type OnDrag, XYDrag } from "@xyflow/system";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup, onMount } from "solid-js";

import { useSolidFlow } from "@/components/contexts/flow";
import type { Edge, Node } from "@/shared/types";

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

function updateDrag(
  domNode: Element,
  dragInstance: XYDragInstance,
  params: Partial<CreateDraggableParams>,
) {
  if (params.disabled) {
    dragInstance.destroy();
    return;
  }

  dragInstance.update({
    domNode,
    noDragClassName: params.noDragClass,
    handleSelector: params.handleSelector,
    nodeId: params.nodeId,
    isSelectable: params.isSelectable,
    nodeClickDistance: params.nodeClickDistance,
  });
}

const createDraggable = (
  elem: Accessor<HTMLElement | undefined>,
  params: Accessor<Partial<CreateDraggableParams>>,
) => {
  const { store, panBy, updateNodePositions, unselectNodesAndEdges } = useSolidFlow<Node, Edge>();

  onMount(() => {
    const dragInstance = XYDrag({
      onDrag: params().onDrag,
      onDragStart: params().onDragStart,
      onDragStop: params().onDragStop,
      onNodeMouseDown: params().onNodeMouseDown,
      getStoreItems: () => {
        const snapGrid = store.snapGrid;
        const vp = store.viewport;

        return {
          nodes: store.nodes,
          nodeLookup: store.nodeLookup,
          edges: store.edges,
          nodeExtent: store.nodeExtent,
          snapGrid: snapGrid ? snapGrid : [0, 0],
          snapToGrid: !!snapGrid,
          nodeOrigin: store.nodeOrigin,
          multiSelectionActive: store.multiselectionKeyPressed,
          domNode: store.domNode,
          transform: [vp.x, vp.y, vp.zoom],
          autoPanOnNodeDrag: store.autoPanOnNodeDrag,
          nodesDraggable: store.nodesDraggable,
          selectNodesOnDrag: store.selectNodesOnDrag,
          nodeDragThreshold: store.nodeDragThreshold,
          unselectNodesAndEdges,
          updateNodePositions,
          panBy,
        };
      },
    });

    createEffect(() => {
      updateDrag(elem()!, dragInstance, params());
    });

    onCleanup(() => {
      dragInstance.destroy();
    });
  });
};

export default createDraggable;
