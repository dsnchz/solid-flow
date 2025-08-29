import {
  type OnMove,
  type OnMoveEnd,
  type OnMoveStart,
  type PanOnScrollMode as SystemPanOnScrollMode,
  type Transform,
  type Viewport,
  XYPanZoom,
} from "@xyflow/system";
import { batch, createEffect, onMount, type ParentProps } from "solid-js";

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
  readonly panOnDrag: boolean | number[];
  readonly paneClickDistance: number;
};

export const Zoom = (props: ParentProps<ZoomProps>) => {
  let ref!: HTMLDivElement;
  const { store, actions } = useInternalSolidFlow();

  const viewPort = () => props.initialViewport || { x: 0, y: 0, zoom: 1 };
  const panOnDrag = () => store.panActivationKeyPressed || props.panOnDrag;
  const panOnScroll = () => store.panActivationKeyPressed || props.panOnScroll;

  const onTransformChange = (transform: Transform) => {
    const [x, y, zoom] = transform;
    actions.setViewport({ x, y, zoom });
  };

  onMount(() => {
    const panZoomInstance = XYPanZoom({
      domNode: ref,
      minZoom: store.minZoom,
      maxZoom: store.maxZoom,
      translateExtent: store.translateExtent,
      viewport: viewPort(),
      paneClickDistance: props.paneClickDistance,
      onDraggingChange: actions.setDragging,
      onPanZoomStart: props.onMoveStart,
      onPanZoom: props.onMove,
      onPanZoomEnd: props.onMoveEnd,
    });

    const vp = panZoomInstance.getViewport();

    if (viewPort().x !== vp.x || viewPort().y !== vp.y || viewPort().zoom !== vp.zoom) {
      onTransformChange([vp.x, vp.y, vp.zoom]);
    }

    batch(() => {
      actions.setViewport(vp);
      actions.setPanZoom(panZoomInstance);
    });

    props.onViewportInitialized?.();

    createEffect(() => {
      panZoomInstance.update({
        lib: store.lib,
        zoomActivationKeyPressed: store.zoomActivationKeyPressed,
        noPanClassName: store.noPanClass,
        noWheelClassName: store.noWheelClass,
        userSelectionActive: !!store.selectionRect,
        panOnScrollSpeed: 0.5,
        panOnDrag: panOnDrag(),
        panOnScroll: panOnScroll(),
        zoomOnScroll: props.zoomOnScroll,
        zoomOnDoubleClick: props.zoomOnDoubleClick,
        zoomOnPinch: props.zoomOnPinch,
        panOnScrollMode: props.panOnScrollMode as SystemPanOnScrollMode,
        preventScrolling:
          typeof props.preventScrolling === "boolean" ? props.preventScrolling : true,
        onTransformChange,
      });
    });
  });

  return (
    <div ref={ref} class="solid-flow__container solid-flow__zoom">
      {props.children}
    </div>
  );
};
