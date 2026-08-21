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
import { createEffect, createSignal, type ParentProps, untrack } from "solid-js";

import type { PanOnScrollMode } from "../../types";
import { useInternalSolidFlow } from "../contexts";

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

export const Zoom = (props: ParentProps<ZoomProps>): JSX.Element => {
  const [ref, setRef] = createSignal<HTMLDivElement>();
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
          onPanZoom: props.onMove,
          onPanZoomEnd: props.onMoveEnd,
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
    },
  );

  // Sync reactive options into the controller
  createEffect(
    () => ({
      panZoom: store.panZoom,
      options: {
        lib: store.lib,
        panActivationKeyPressed: store.panActivationKeyPressed,
        zoomActivationKeyPressed: store.zoomActivationKeyPressed,
        noPanClassName: store.noPanClass,
        noWheelClassName: store.noWheelClass,
        userSelectionActive: !!store.selectionRect,
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
        connectionInProgress: store.connection.inProgress,
      },
    }),
    ({ panZoom, options }) => {
      panZoom?.update({ ...options, onTransformChange });
    },
  );

  return (
    <div ref={setRef} class="solid-flow__container solid-flow__zoom">
      {props.children}
    </div>
  );
};
