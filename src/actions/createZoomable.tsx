import type { OnPanZoom, PanOnScrollMode, Transform, Viewport } from "@xyflow/system";
import { XYPanZoom } from "@xyflow/system";
import type { Accessor } from "solid-js";
import { createEffect, onMount } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts/flow";

export type ZoomDirectiveParams = {
  readonly initialViewport: Viewport;
  readonly preventScrolling: boolean;
  readonly panOnScroll: boolean;
  readonly panOnDrag: boolean | number[];
  readonly panOnScrollMode: PanOnScrollMode;
  readonly panOnScrollSpeed: number;
  readonly paneClickDistance: number;
  readonly zoomOnPinch: boolean;
  readonly zoomOnScroll: boolean;
  readonly zoomOnDoubleClick: boolean;
  readonly onPanZoomStart?: OnPanZoom;
  readonly onPanZoom?: OnPanZoom;
  readonly onPanZoomEnd?: OnPanZoom;
  readonly onPaneContextMenu?: (event: MouseEvent) => void;
};

const createZoomable = (
  elem: Accessor<HTMLElement | undefined>,
  params: Accessor<ZoomDirectiveParams>,
) => {
  const { store, actions } = useInternalSolidFlow();

  const onTransformChange = (transform: Transform) => {
    const [x, y, zoom] = transform;
    actions.setViewport({ x, y, zoom });
  };

  onMount(() => {
    const panZoomInstance = XYPanZoom({
      domNode: elem()!,
      minZoom: store.minZoom,
      maxZoom: store.maxZoom,
      translateExtent: store.translateExtent,
      viewport: params().initialViewport,
      paneClickDistance: params().paneClickDistance,
      onDraggingChange: actions.setDragging,
      onPanZoomStart: params().onPanZoomStart,
      onPanZoom: params().onPanZoom,
      onPanZoomEnd: params().onPanZoomEnd,
    });

    const vp = panZoomInstance.getViewport();

    if (
      params().initialViewport.x !== vp.x ||
      params().initialViewport.y !== vp.y ||
      params().initialViewport.zoom !== vp.zoom
    ) {
      onTransformChange([vp.x, vp.y, vp.zoom]);
    }

    actions.setViewport(vp);
    actions.setPanZoom(panZoomInstance);

    createEffect(() => {
      panZoomInstance.update({
        lib: store.lib,
        zoomActivationKeyPressed: store.zoomActivationKeyPressed,
        noPanClassName: store.noPanClass,
        noWheelClassName: store.noWheelClass,
        userSelectionActive: !!store.selectionRect,
        onTransformChange,
        ...params(),
      });
    });
  });
};

export default createZoomable;
