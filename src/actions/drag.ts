import { type OnDrag, XYDrag } from "@xyflow/system";
import type { Accessor } from "solid-js";

import { useSolidFlow } from "@/components/contexts/flow";
import type { Edge, Node } from "@/shared/types";

export type DragDirectiveParams = {
  disabled?: boolean;
  noDragClass?: string;
  handleSelector?: string;
  nodeId?: string;
  isSelectable?: boolean;
  nodeClickDistance?: number;
  onDrag?: OnDrag;
  onDragStart?: OnDrag;
  onDragStop?: OnDrag;
  onNodeMouseDown?: (id: string) => void;
};

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      readonly drag: DragDirectiveParams;
    }
  }
}

export default function drag(domNode: Element, params: Accessor<DragDirectiveParams>) {
  const { onDrag, onDragStart, onDragStop, onNodeMouseDown } = params();
  const { store, panBy, updateNodePositions, unselectNodesAndEdges } = useSolidFlow<Node, Edge>();

  const dragInstance = XYDrag({
    onDrag,
    onDragStart,
    onDragStop,
    onNodeMouseDown,
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

  function updateDrag(domNode: Element, params: DragDirectiveParams) {
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

  updateDrag(domNode, params());

  return {
    update(params: DragDirectiveParams) {
      updateDrag(domNode, params);
    },
    destroy() {
      dragInstance.destroy();
    },
  };
}
