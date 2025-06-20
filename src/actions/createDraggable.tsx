import { type OnDrag, XYDrag } from "@xyflow/system";
import type { Accessor } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts/flow";
import type { Node } from "@/shared/types";

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

type OnNodeDrag<NodeType extends Node> = (
  event: MouseEvent,
  node: NodeType,
  nodes: NodeType[],
) => void;

const createDraggable = <NodeType extends Node>(
  elem: Accessor<HTMLElement | undefined>,
  params: Accessor<Partial<CreateDraggableParams>>,
) => {
  const { store, nodeLookup, panBy, updateNodePositions, unselectNodesAndEdges } =
    useInternalSolidFlow();
  const [dragging, setDragging] = createSignal(false);

  onMount(() => {
    const { onDrag, onDragStart, onDragStop, onNodeMouseDown } = params();

    const dragInstance = XYDrag<OnNodeDrag<NodeType>>({
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
          unselectNodesAndEdges,
          updateNodePositions,
          panBy,
        };
      },
    });

    function updateDrag(elem: Element, params: Partial<CreateDraggableParams>) {
      if (params.disabled) {
        dragInstance.destroy();
        return;
      }

      dragInstance.update({
        domNode: elem,
        nodeId: params.nodeId,
        noDragClassName: params.noDragClass,
        handleSelector: params.handleSelector,
        isSelectable: params.isSelectable,
        nodeClickDistance: params.nodeClickDistance,
      });
    }

    createEffect(() => {
      updateDrag(elem()!, params());
    });

    onCleanup(() => {
      dragInstance.destroy();
    });
  });

  return dragging;
};

export default createDraggable;
