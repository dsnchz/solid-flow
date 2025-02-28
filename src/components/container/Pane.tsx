import { getConnectedEdges, getEventPosition, getNodesInside, SelectionMode } from "@xyflow/system";
import clsx from "clsx";
import { type ParentComponent } from "solid-js";
import { produce } from "solid-js/store";

import { useFlowStore } from "@/components/contexts";
import type { Edge, InternalNode, Node } from "@/shared/types";
import type { MouseOrTouchEventHandler } from "@/shared/types/events";

const wrapHandler = (
  handler: (evt: MouseEvent) => void,
  container: HTMLDivElement,
): ((evt: MouseEvent) => void) => {
  return (event: MouseEvent) => {
    if (event.target !== container) {
      return;
    }

    handler?.(event);
  };
};

const toggleSelected = <Item extends Node | Edge>(ids: string[]) => {
  return (item: Item) => {
    const isSelected = ids.includes(item.id);

    if (item.selected !== isSelected) {
      item.selected = isSelected;
    }

    return item;
  };
};

export type PaneProps = {
  readonly onPaneClick?: MouseOrTouchEventHandler;
  readonly onPaneContextMenu?: MouseOrTouchEventHandler;
  readonly panOnDrag?: boolean | number[];
  readonly selectionOnDrag?: boolean;
};

const Pane: ParentComponent<PaneProps> = (props) => {
  const { store, unselectNodesAndEdges, setNodes, setEdges, setStore } = useFlowStore();
  let container: HTMLDivElement | undefined;
  let containerBounds: DOMRect | null = null;
  let selectedNodes: InternalNode[] = [];

  const _panOnDrag = () => store.panActivationKeyPressed || props.panOnDrag;
  const isSelecting = () =>
    store.selectionKeyPressed ||
    store.selectionRect ||
    (props.selectionOnDrag && _panOnDrag() !== true);
  const hasActiveSelection = () =>
    store.elementsSelectable && (isSelecting() || store.selectionRectMode === "user");

  // Used to prevent click events when the user lets go of the selectionKey during a selection
  let selectionInProgress = false;

  const onClick = (event: MouseEvent | TouchEvent) => {
    // We prevent click events when the user let go of the selectionKey during a selection
    if (selectionInProgress) {
      selectionInProgress = false;
      return;
    }

    props.onPaneClick?.(event);

    unselectNodesAndEdges();
    setStore("selectionRectMode", undefined);
  };

  const onPointerDown = (event: PointerEvent) => {
    containerBounds = container?.getBoundingClientRect() ?? null;

    if (
      !store.elementsSelectable ||
      !isSelecting() ||
      event.button !== 0 ||
      event.target !== container ||
      !containerBounds
    ) {
      return;
    }

    (event.target as Partial<Element> | null)?.setPointerCapture?.(event.pointerId);

    const { x, y } = getEventPosition(event, containerBounds);

    unselectNodesAndEdges();

    setStore("selectionRect", {
      width: 0,
      height: 0,
      startX: x,
      startY: y,
      x,
      y,
    });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isSelecting() || !containerBounds || !store.selectionRect) {
      return;
    }

    selectionInProgress = true;

    const mousePos = getEventPosition(event, containerBounds);
    const startX = store.selectionRect?.startX ?? 0;
    const startY = store.selectionRect?.startY ?? 0;
    const nextUserSelectRect = {
      ...store.selectionRect!,
      x: mousePos.x < startX ? mousePos.x : startX,
      y: mousePos.y < startY ? mousePos.y : startY,
      width: Math.abs(mousePos.x - startX),
      height: Math.abs(mousePos.y - startY),
    };

    const prevSelectedNodeIds = selectedNodes.map((n) => n.id);
    const prevSelectedEdgeIds = getConnectedEdges(selectedNodes, store.edges).map((e) => e.id);

    selectedNodes = getNodesInside(
      store.nodeLookup,
      nextUserSelectRect,
      [store.viewport.x, store.viewport.y, store.viewport.zoom],
      store.selectionMode === SelectionMode.Partial,
      true,
    );

    const selectedEdgeIds = getConnectedEdges(selectedNodes, store.edges).map((e) => e.id);
    const selectedNodeIds = selectedNodes.map((n) => n.id);

    // this prevents unnecessary updates while updating the selection rectangle
    if (
      prevSelectedNodeIds.length !== selectedNodeIds.length ||
      selectedNodeIds.some((id) => !prevSelectedNodeIds.includes(id))
    ) {
      setNodes((nodes) => nodes.map(toggleSelected(selectedNodeIds)));
    }

    if (
      prevSelectedEdgeIds.length !== selectedEdgeIds.length ||
      selectedEdgeIds.some((id) => !prevSelectedEdgeIds.includes(id))
    ) {
      setEdges((edges) => edges.map(toggleSelected(selectedEdgeIds)));
    }

    setStore(
      produce((store) => {
        store.selectionRectMode = "user";
        store.selectionRect = nextUserSelectRect;
      }),
    );
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    (event.target as Partial<Element> | null)?.releasePointerCapture?.(event.pointerId);

    // We only want to trigger click functions when in selection mode if
    // the user did not move the mouse.
    if (!isSelecting() && store.selectionRectMode === "user" && event.target === container) {
      onClick?.(event);
    }

    setStore("selectionRect", undefined);

    if (selectedNodes.length > 0) {
      setStore("selectionRectMode", "nodes");
    }

    // If the user kept holding the selectionKey during the selection,
    // we need to reset the selectionInProgress, so the next click event is not prevented
    if (store.selectionKeyPressed) {
      selectionInProgress = false;
    }
  };

  const onContextMenu = (event: MouseEvent) => {
    const result = _panOnDrag();

    if (Array.isArray(result) && result.includes(2)) {
      event.preventDefault();
      return;
    }

    props.onPaneContextMenu?.(event);
  };

  return (
    <div
      ref={container}
      class={clsx("solid-flow__container solid-flow__pane", {
        selection: isSelecting(),
        dragging: store.dragging,
        draggable:
          props.panOnDrag === true ||
          (Array.isArray(props.panOnDrag) && props.panOnDrag.includes(0)),
      })}
      onClick={(e) => (hasActiveSelection() ? undefined : wrapHandler(onClick, container!)(e))}
      onPointerDown={(e) => (hasActiveSelection() ? onPointerDown(e) : undefined)}
      onPointerMove={(e) => (hasActiveSelection() ? onPointerMove(e) : undefined)}
      onPointerUp={(e) => (hasActiveSelection() ? onPointerUp(e) : undefined)}
      onContextMenu={(e) => wrapHandler(onContextMenu, container!)(e)}
    >
      {props.children}
    </div>
  );
};

export default Pane;
