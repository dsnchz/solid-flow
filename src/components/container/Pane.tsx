import { createEventListener } from "@solid-primitives/event-listener";
import type { JSX } from "@solidjs/web";
import {
  calcAutoPan,
  getEventPosition,
  getNodesInside,
  nodeToRect,
  pointToRendererPoint,
  rendererPointToPoint,
  SelectionMode,
  type XYPosition,
} from "@xyflow/system";
import { createSignal, flush, onCleanup, type ParentProps } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import { GestureSpatialLookup } from "@/core/spatial/gestureLookup";
import type { Edge, InternalNode, Node, PaneEvents } from "@/types";
import { isEdgeSelectable } from "@/utils";

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

/** Internal interaction surface handling pane clicks, the selection box, and pan gestures. */
export const Pane = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: ParentProps<PaneProps>,
): JSX.Element => {
  const { store, nodeLookup, edgeLookup, connections, actions } = useInternalSolidFlow<
    NodeType,
    EdgeType
  >();

  const [containerRef, setContainerRef] = createSignal<HTMLDivElement>();
  let container: HTMLDivElement | undefined;
  let containerBounds: DOMRect | null = null;
  let connectionEndedOnPane = false;

  // Used to prevent click events when the user lets go of the selectionKey during a selection
  let selectionInProgress = false;
  const selectionSpatialLookup = new GestureSpatialLookup<InternalNode<NodeType>>(nodeLookup, 400);
  let selectedNodeIds: Set<string> = new Set();
  let selectedEdgeIds: Set<string> = new Set();

  // Used for auto pan when approaching the edges of the container during selection
  let autoPanId = 0;
  let position: XYPosition = { x: 0, y: 0 };
  let autoPanStarted = false;

  const autoPanOnSelection = () => props.autoPanOnSelection ?? true;
  // Default lives in ONE place (SolidFlow's merge, 0); this fallback only
  // covers direct Pane mounting in tests.
  const paneClickDistance = () => props.paneClickDistance ?? 0;

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

    actions.unselectNodesAndEdges();
    actions.setSelectionRectMode(undefined);
    actions.setSelectionRect(undefined);
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

    // RFC-4239 win #3: node geometry is frozen during a selection gesture —
    // snapshot it so the per-move getNodesInside sweep only sees candidates
    // near the selection rect instead of every node.
    selectionSpatialLookup.arm((node) => nodeToRect(node));

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
    // Commit immediately: the next pointermove in this gesture must see the rect
    flush();

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

    {
      const [tx, ty, zoom] = store.transform;
      selectionSpatialLookup.setQueryRect({
        x: (nextUserSelectRect.x - tx) / zoom,
        y: (nextUserSelectRect.y - ty) / zoom,
        width: nextUserSelectRect.width / zoom,
        height: nextUserSelectRect.height / zoom,
      });
    }
    selectedNodeIds = new Set(
      getNodesInside(
        selectionSpatialLookup,
        nextUserSelectRect,
        store.transform,
        store.selectionMode === SelectionMode.Partial,
        true,
      ).map((n) => n.id),
    );

    selectedEdgeIds = new Set();

    // We look for all edges connected to the selected nodes
    for (const nodeId of selectedNodeIds) {
      const nodeConnections = connections[nodeId];
      if (!nodeConnections) continue;

      for (const { edgeId } of Object.values(nodeConnections)) {
        const edge = edgeLookup[edgeId];
        if (edge && isEdgeSelectable(edge, store)) {
          selectedEdgeIds.add(edgeId);
        }
      }
    }

    // this prevents unnecessary updates while updating the selection rectangle
    if (!isSetEqual(prevSelectedNodeIds, selectedNodeIds)) {
      actions.setNodes((nodes) => {
        for (const node of nodes) {
          const isSelected = selectedNodeIds.has(node.id);
          if (!!node.selected !== isSelected) node.selected = isSelected;
        }
        return undefined;
      });
    }

    if (!isSetEqual(prevSelectedEdgeIds, selectedEdgeIds)) {
      actions.setEdges((edges) => {
        for (const edge of edges) {
          const isSelected = selectedEdgeIds.has(edge.id);
          if (!!edge.selected !== isSelected) edge.selected = isSelected;
        }
        return undefined;
      });
    }

    actions.setSelectionRectMode("user");
    actions.setSelectionRect(nextUserSelectRect);
    flush();
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

    actions.setSelectionRect(undefined);

    if (selectionInProgress) {
      actions.setSelectionRectMode(selectedNodeIds.size > 0 ? "nodes" : undefined);
    }
    flush();

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

  createEventListener(
    containerRef,
    "pointerdown",
    (e) => {
      if (isSelectionEnabled()) onPointerDownCapture(e);
    },
    { capture: true },
  );

  createEventListener(
    containerRef,
    "click",
    (e) => {
      if (isSelectionEnabled()) onClickCapture(e);
    },
    { capture: true },
  );

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
        setContainerRef(el);
      }}
      onWheel={(event) => props.onPaneScroll?.({ event })}
      onPointerEnter={(event) => props.onPanePointerEnter?.({ event })}
      onPointerLeave={(event) => props.onPanePointerLeave?.({ event })}
      class={[
        "solid-flow__container solid-flow__pane",
        {
          selection: !!isSelecting(),
          dragging: store.dragging,
          draggable:
            props.panOnDrag === true ||
            (Array.isArray(props.panOnDrag) && props.panOnDrag.includes(0)),
        },
      ]}
      onClick={(e) => (isSelectionEnabled() ? undefined : onClick(e))}
      onPointerMove={(e) => {
        props.onPanePointerMove?.({ event: e });
        if (isSelectionEnabled()) onPointerMove(e);
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => (isSelectionEnabled() ? onPointerCancel(e) : undefined)}
      onContextMenu={onContextMenu}
    >
      {props.children}
    </div>
  );
};
