import {
  calcAutoPan,
  getEventPosition,
  getNodesInside,
  pointToRendererPoint,
  rendererPointToPoint,
  SelectionMode,
  type XYPosition,
} from "@xyflow/system";
import clsx from "clsx";
import { batch, type JSX, onCleanup, type ParentProps } from "solid-js";
import { produce } from "solid-js/store";

import type { Edge, Node, PaneEvents } from "../../types";
import { useInternalSolidFlow } from "../contexts";

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
  readonly paneClickDistance?: number;
  readonly autoPanOnSelection?: boolean;
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
  let connectionEndedOnPane = false;

  // Used to prevent click events when the user lets go of the selectionKey during a selection
  let selectionInProgress = false;
  let selectedNodeIds: Set<string> = new Set();
  let selectedEdgeIds: Set<string> = new Set();

  // Used for auto pan when approaching the edges of the container during selection
  let autoPanId = 0;
  let position: XYPosition = { x: 0, y: 0 };
  let autoPanStarted = false;

  const autoPanOnSelection = () => props.autoPanOnSelection ?? true;
  const paneClickDistance = () => props.paneClickDistance ?? 1;

  const _panOnDrag = () => store.panActivationKeyPressed || props.panOnDrag;

  const isSelecting = () =>
    store.selectionKeyPressed ||
    !!store.selectionRect ||
    (props.selectionOnDrag && _panOnDrag() !== true);

  const isSelectionEnabled = () =>
    store.elementsSelectable && (isSelecting() || store.selectionRectMode === "user");

  const onClick = (event: MouseEvent) => {
    if (event.target !== container) return;

    // We prevent click events when the user let go of the selectionKey during a selection.
    // We also prevent click events when a connection is in progress.
    if (selectionInProgress || store.connection.inProgress || connectionEndedOnPane) {
      selectionInProgress = false;
      connectionEndedOnPane = false;
      return;
    }

    props.onPaneClick?.({ event });

    batch(() => {
      actions.unselectNodesAndEdges();
      actions.setSelectionRectMode(undefined);
      actions.setSelectionRect(undefined);
    });
  };

  // We start the selection process when the user clicks down on the pane
  const onPointerDownCapture = (event: PointerEvent) => {
    // Mouse button arrays only restrict mouse input. Let touch panning handle this gesture
    // unless the user explicitly activated selection with the selection key.
    if (event.pointerType === "touch" && _panOnDrag() !== false && !store.selectionKeyPressed) {
      return;
    }

    containerBounds = container?.getBoundingClientRect() ?? null;
    if (!containerBounds) return;

    const eventTargetIsContainer = event.target === container;

    const isNoKeyEvent =
      !eventTargetIsContainer && !!(event.target as HTMLElement).closest(".nokey");

    const isSelectionActive =
      (props.selectionOnDrag && eventTargetIsContainer) || store.selectionKeyPressed;

    if (
      isNoKeyEvent ||
      !isSelecting() ||
      !isSelectionActive ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return;
    }

    (event.target as Partial<Element> | null)?.setPointerCapture?.(event.pointerId);

    selectionInProgress = false;
    autoPanStarted = false;

    const { x, y } = getEventPosition(event, containerBounds);

    // We convert the position to the flow space so that it stays fixed on the canvas while auto-panning
    const userSelectionFlowOrigin = pointToRendererPoint({ x, y }, store.transform);

    actions.setSelectionRect({
      width: 0,
      height: 0,
      startX: userSelectionFlowOrigin.x,
      startY: userSelectionFlowOrigin.y,
      x,
      y,
    });

    if (!eventTargetIsContainer) {
      event.stopPropagation();
      event.preventDefault();
    }
  };

  // We commit the user selection rectangle to the store on auto-panning or pointer move
  const commitUserSelectionRect = (mouseX: number, mouseY: number) => {
    const selectionRect = store.selectionRect;

    if (selectionRect?.startX === undefined || selectionRect.startY === undefined) {
      return;
    }

    // startX/startY are in flow space so the selection origin stays fixed while auto-panning
    const userStartPosition = { x: selectionRect.startX, y: selectionRect.startY };
    const screenStart = rendererPointToPoint(userStartPosition, store.transform);

    const nextUserSelectRect = {
      startX: userStartPosition.x,
      startY: userStartPosition.y,
      x: mouseX < screenStart.x ? mouseX : screenStart.x,
      y: mouseY < screenStart.y ? mouseY : screenStart.y,
      width: Math.abs(mouseX - screenStart.x),
      height: Math.abs(mouseY - screenStart.y),
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

    batch(() => {
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
    });
  };

  const autoPan = () => {
    if (!autoPanOnSelection() || !containerBounds) {
      return;
    }

    const [x = 0, y = 0] = calcAutoPan(position, containerBounds, store.autoPanSpeed);

    void actions.panBy({ x, y }).then((panned) => {
      if (!selectionInProgress || !panned) {
        autoPanId = requestAnimationFrame(autoPan);
        return;
      }

      commitUserSelectionRect(position.x, position.y);
      autoPanId = requestAnimationFrame(autoPan);
    });
  };

  const cleanupAutoPan = () => {
    // autoPanId is only ever set in the browser; guarding also keeps the
    // disposal path SSR-safe (no cancelAnimationFrame on the server)
    if (autoPanId) {
      cancelAnimationFrame(autoPanId);
      autoPanId = 0;
    }
    autoPanStarted = false;
  };

  onCleanup(() => {
    cleanupAutoPan();
  });

  const onPointerMove = (event: PointerEvent) => {
    if (!isSelecting() || !containerBounds || !store.selectionRect) {
      return;
    }

    const mousePos = getEventPosition(event, containerBounds);
    position = { x: mousePos.x, y: mousePos.y };

    const userStartPosition = {
      x: store.selectionRect.startX ?? 0,
      y: store.selectionRect.startY ?? 0,
    };
    const screenStart = rendererPointToPoint(userStartPosition, store.transform);

    if (!selectionInProgress) {
      const requiredDistance = store.selectionKeyPressed ? 0 : paneClickDistance();
      const distance = Math.hypot(mousePos.x - screenStart.x, mousePos.y - screenStart.y);

      if (distance <= requiredDistance) {
        return;
      }

      actions.unselectNodesAndEdges();
      props.onSelectionStart?.(event);
    }

    selectionInProgress = true;

    if (!autoPanStarted) {
      autoPan();
      autoPanStarted = true;
    }

    commitUserSelectionRect(mousePos.x, mousePos.y);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!isSelectionEnabled()) {
      if (event.target === container && store.connection.inProgress) {
        connectionEndedOnPane = true;
      }
      return;
    }

    if (event.button !== 0) return;

    (event.target as Partial<Element> | null)?.releasePointerCapture?.(event.pointerId);

    // We only want to trigger click functions when in selection mode if
    // the user did not move the mouse.
    if (!selectionInProgress && event.target === container) {
      onClick(event);
    }

    batch(() => {
      actions.setSelectionRect(undefined);

      if (selectionInProgress) {
        actions.setSelectionRectMode(selectedNodeIds.size > 0 ? "nodes" : undefined);
      }
    });

    if (selectionInProgress) {
      props.onSelectionEnd?.(event);
    }

    cleanupAutoPan();
  };

  const onPointerCancel = (event: PointerEvent) => {
    (event.target as Partial<Element> | null)?.releasePointerCapture?.(event.pointerId);
    cleanupAutoPan();
  };

  const onClickCapture = (event: MouseEvent) => {
    if (selectionInProgress) {
      event.stopPropagation();
      selectionInProgress = false;
    }
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
      ref={(el) => {
        container = el;
        // Capture-phase listener so a click that ends a selection drag never reaches children
        el.addEventListener(
          "click",
          (e) => {
            if (isSelectionEnabled()) onClickCapture(e);
          },
          { capture: true },
        );
      }}
      class={clsx("solid-flow__container solid-flow__pane", {
        selection: isSelecting(),
        dragging: store.dragging,
        draggable:
          props.panOnDrag === true ||
          (Array.isArray(props.panOnDrag) && props.panOnDrag.includes(0)),
      })}
      onClick={(e) => (isSelectionEnabled() ? undefined : onClick(e))}
      on:pointerdown={{
        capture: true,
        handleEvent: (e) => {
          if (isSelectionEnabled()) onPointerDownCapture(e);
        },
      }}
      onPointerMove={(e) => (isSelectionEnabled() ? onPointerMove(e) : undefined)}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => (isSelectionEnabled() ? onPointerCancel(e) : undefined)}
      onContextMenu={onContextMenu}
    >
      {props.children}
    </div>
  );
};
