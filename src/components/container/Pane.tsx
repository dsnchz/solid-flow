import { getEventPosition, getNodesInside, SelectionMode } from "@xyflow/system";
import clsx from "clsx";
import type { JSX, ParentProps } from "solid-js";
import { produce } from "solid-js/store";

import { useInternalSolidFlow } from "@/components/contexts";
import type { Edge, Node } from "@/shared/types";
import type { PaneEvents } from "@/types";

const isSetEqual = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;

  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }

  return true;
};

export type PaneProps = PaneEvents & {
  readonly panOnDrag?: boolean | number[];
  readonly selectionOnDrag?: boolean;
  readonly onSelectionStart?: (event: PointerEvent) => void;
  readonly onSelectionEnd?: (event: PointerEvent) => void;
};

export const Pane = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<PaneProps>,
): JSX.Element => {
  const { store, nodeLookup, edgeLookup, connectionLookup, actions } = useInternalSolidFlow<
    NodeType,
    EdgeType
  >();

  let container: HTMLDivElement | undefined;
  let containerBounds: DOMRect | null = null;

  // Used to prevent click events when the user lets go of the selectionKey during a selection
  let selectionInProgress = false;
  let selectedNodeIds: Set<string> = new Set();
  let selectedEdgeIds: Set<string> = new Set();

  const _panOnDrag = () => store.panActivationKeyPressed || props.panOnDrag;

  const isSelecting = () =>
    store.selectionKeyPressed ||
    store.selectionRect ||
    (props.selectionOnDrag && _panOnDrag() !== true);

  const hasActiveSelection = () =>
    store.elementsSelectable && (isSelecting() || store.selectionRectMode === "user");

  const onClick = (event: MouseEvent) => {
    if (event.target !== container) return;

    // We prevent click events when the user let go of the selectionKey during a selection
    if (selectionInProgress) {
      selectionInProgress = false;
      return;
    }

    props.onPaneClick?.({ event });

    actions.unselectNodesAndEdges();
    actions.setSelectionRectMode(undefined);
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

    actions.unselectNodesAndEdges();

    actions.setSelectionRect({
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
    const { startX = 0, startY = 0 } = store.selectionRect;

    const nextUserSelectRect = {
      ...store.selectionRect,
      x: mousePos.x < startX ? mousePos.x : startX,
      y: mousePos.y < startY ? mousePos.y : startY,
      width: Math.abs(mousePos.x - startX),
      height: Math.abs(mousePos.y - startY),
    };

    const prevSelectedNodeIds = selectedNodeIds;
    const prevSelectedEdgeIds = selectedEdgeIds;

    selectedNodeIds = new Set(
      getNodesInside(
        nodeLookup,
        nextUserSelectRect,
        store.transform,
        store.selectionMode === SelectionMode.Partial,
        true,
      ).map((n) => n.id),
    );

    const edgesSelectable = store.defaultEdgeOptions.selectable ?? true;
    selectedEdgeIds = new Set();

    // We look for all edges connected to the selected nodes
    for (const nodeId of selectedNodeIds) {
      const connections = connectionLookup.get(nodeId);
      if (!connections) continue;

      for (const { edgeId } of connections.values()) {
        const edge = edgeLookup.get(edgeId);
        if (edge && (edge.selectable ?? edgesSelectable)) {
          selectedEdgeIds.add(edgeId);
        }
      }
    }

    // this prevents unnecessary updates while updating the selection rectangle
    if (!isSetEqual(prevSelectedNodeIds, selectedNodeIds)) {
      const selectionMap = new Map<string, boolean>();

      actions.setNodes(
        (node) => {
          const isSelected = selectedNodeIds.has(node.id);
          selectionMap.set(node.id, isSelected);
          return !!node.selected !== isSelected;
        },
        produce((node) => {
          node.selected = selectionMap.get(node.id);
        }),
      );
    }

    if (!isSetEqual(prevSelectedEdgeIds, selectedEdgeIds)) {
      const selectionMap = new Map<string, boolean>();

      actions.setEdges(
        (edge) => {
          const isSelected = selectedEdgeIds.has(edge.id);
          selectionMap.set(edge.id, isSelected);
          return !!edge.selected !== isSelected;
        },
        produce((edge) => {
          edge.selected = selectionMap.get(edge.id);
        }),
      );
    }

    actions.setSelectionRectMode("user");
    actions.setSelectionRect(nextUserSelectRect);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;

    (event.target as Partial<Element> | null)?.releasePointerCapture?.(event.pointerId);

    // We only want to trigger click functions when in selection mode if
    // the user did not move the mouse.
    if (!isSelecting() && store.selectionRectMode === "user" && event.target === container) {
      onClick(event);
    }

    actions.setSelectionRect(undefined);

    if (selectedNodeIds.size > 0) {
      actions.setSelectionRectMode("nodes");
    }

    // If the user kept holding the selectionKey during the selection,
    // we need to reset the selectionInProgress, so the next click event is not prevented
    if (store.selectionKeyPressed) {
      selectionInProgress = false;
    }

    props.onSelectionEnd?.(event);
  };

  const onContextMenu = (event: PointerEvent) => {
    if (event.target !== container) return;

    const result = _panOnDrag();

    if (Array.isArray(result) && result.includes(2)) {
      event.preventDefault();
      return;
    }

    props.onPaneContextMenu?.({ event });
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
      onClick={(e) => (hasActiveSelection() ? undefined : onClick(e))}
      onPointerDown={(e) => (hasActiveSelection() ? onPointerDown(e) : undefined)}
      onPointerMove={(e) => (hasActiveSelection() ? onPointerMove(e) : undefined)}
      onPointerUp={(e) => (hasActiveSelection() ? onPointerUp(e) : undefined)}
      onContextMenu={onContextMenu}
    >
      {props.children}
    </div>
  );
};
