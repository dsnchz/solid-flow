import type { JSX } from "@solidjs/web";
import {
  type OnMove,
  type OnMoveEnd,
  type OnMoveStart,
  type PanOnScrollMode as SystemPanOnScrollMode,
  type Transform,
  type Viewport,
  XYPanZoom,
} from "@xyflow/system";
import { createEffect, createMemo, createSignal, type ParentProps, Show, untrack } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import type { PanOnScrollMode } from "@/types";

export type ZoomProps = {
  readonly initialViewport?: Viewport;
  readonly panOnScrollMode: PanOnScrollMode;
  readonly onMove?: OnMove;
  readonly onMoveStart?: OnMoveStart;
  readonly onMoveEnd?: OnMoveEnd;
  readonly onViewportInitialized?: () => void;
  readonly preventScrolling: boolean;
  readonly zoomOnScroll: boolean;
  readonly zoomOnDoubleClick: boolean;
  readonly zoomOnPinch: boolean;
  readonly panOnScroll: boolean;
  readonly panOnScrollSpeed: number;
  readonly panOnDrag: boolean | number[];
  readonly paneClickDistance: number;
  readonly selectionOnDrag?: boolean;
};

/** Internal viewport controller wiring pan/zoom gestures (XYPanZoom) to the flow. */
export const Zoom = (props: ParentProps<ZoomProps>): JSX.Element => {
  const [ref, setRef] = createSignal<HTMLDivElement>();
  // Pan in progress (pointer moved): drives the cursor cover element below.
  const [panning, setPanning] = createSignal(false);
  const { store, actions } = useInternalSolidFlow();

  const viewPort = () => props.initialViewport || { x: 0, y: 0, zoom: 1 };
  const panOnDrag = () => store.panActivationKeyPressed || props.panOnDrag;
  const panOnScroll = () => store.panActivationKeyPressed || props.panOnScroll;

  const onTransformChange = (transform: Transform) => {
    const [x, y, zoom] = transform;
    actions.setViewport({ x, y, zoom });
  };

  // Mount the pan/zoom controller on the container (external system: XYPanZoom/d3)
  createEffect(
    () => ref(),
    (el) => {
      if (!el) return;

      const panZoomInstance = untrack(() =>
        XYPanZoom({
          domNode: el,
          minZoom: store.minZoom,
          maxZoom: store.maxZoom,
          translateExtent: store.translateExtent,
          viewport: viewPort(),
          onDraggingChange: actions.setDragging,
          onPanZoomStart: props.onMoveStart,
          // The pan cursor cover appears on the first MOVE of a pointer pan,
          // never on start: a plain click also starts a d3-zoom gesture, and a
          // cover under the mouseup would swallow the click.
          onPanZoom: (event, viewport) => {
            if (!panning() && untrack(() => store.dragging)) setPanning(true);
            props.onMove?.(event, viewport);
          },
          onPanZoomEnd: (event, viewport) => {
            setPanning(false);
            props.onMoveEnd?.(event, viewport);
          },
        }),
      );

      const vp = panZoomInstance.getViewport();
      const initial = untrack(() => viewPort());

      if (initial.x !== vp.x || initial.y !== vp.y || initial.zoom !== vp.zoom) {
        onTransformChange([vp.x, vp.y, vp.zoom]);
      }

      actions.setViewport(vp);
      actions.setPanZoom(panZoomInstance);

      props.onViewportInitialized?.();

      // Tear the controller down with the pane: a hoisted state must not keep
      // the d3 bindings and the detached pane element alive.
      return () => {
        panZoomInstance.destroy();
        actions.setPanZoom(null);
      };
    },
  );

  // Sync reactive options into the controller
  // Equality-cut booleans for the two gesture flags: `store.connection` is a
  // fresh object every pointermove and `selectionRect` a new rect every
  // box-selection move, so tracking them directly re-ran this effect — and
  // panZoom.update() rebound every d3 handler — on every move of both
  // gestures. Booleans change once per gesture.
  const connectionInProgress = createMemo(() => store.connection.inProgress);
  const userSelectionActive = createMemo(() => !!store.selectionRect);
  createEffect(
    () => ({
      panZoom: store.panZoom,
      options: {
        lib: store.lib,
        panActivationKeyPressed: store.panActivationKeyPressed,
        zoomActivationKeyPressed: store.zoomActivationKeyPressed,
        noPanClassName: store.noPanClass,
        noWheelClassName: store.noWheelClass,
        userSelectionActive: userSelectionActive(),
        panOnScrollSpeed: props.panOnScrollSpeed,
        panOnDrag: panOnDrag(),
        panOnScroll: panOnScroll(),
        zoomOnScroll: props.zoomOnScroll,
        zoomOnDoubleClick: props.zoomOnDoubleClick,
        zoomOnPinch: props.zoomOnPinch,
        panOnScrollMode: props.panOnScrollMode as SystemPanOnScrollMode,
        preventScrolling:
          typeof props.preventScrolling === "boolean" ? props.preventScrolling : true,
        paneClickDistance: props.paneClickDistance,
        selectionOnDrag: props.selectionOnDrag,
        connectionInProgress: connectionInProgress(),
      },
    }),
    ({ panZoom, options }) => {
      panZoom?.update({ ...options, onTransformChange });
    },
  );

  return (
    <div ref={setRef} class="solid-flow__container solid-flow__zoom">
      {props.children}
      {/* Cursor cover for a held pan: `cursor` is inherited, so setting it on
          the pane re-styles every descendant (~70ms style recalc at pan start
          and end @10k, bench round 26); a leaf element on top costs nothing. */}
      <Show when={panning()}>
        <div class="solid-flow__pan-cursor" />
      </Show>
    </div>
  );
};
