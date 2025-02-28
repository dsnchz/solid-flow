import type { OnPanZoom, PanOnScrollMode, Transform, Viewport } from "@xyflow/system";
import { XYPanZoom } from "@xyflow/system";
import type { Accessor } from "solid-js";
import { createEffect, onMount } from "solid-js";
import { produce } from "solid-js/store";

import { useSolidFlow } from "@/components/contexts/flow";

export type ZoomDirectiveParams = {
  readonly initialViewport: Viewport;
  readonly preventScrolling: boolean;
  readonly panOnScroll: boolean;
  readonly panOnDrag: boolean | number[];
  readonly panOnScrollMode: PanOnScrollMode;
  readonly panOnScrollSpeed: number;
  readonly paneClickDistance: number;
  readonly userSelectionActive: boolean;
  readonly zoomOnPinch: boolean;
  readonly zoomOnScroll: boolean;
  readonly zoomOnDoubleClick: boolean;
  // last two instances of 'classname' being used
  // changing it to class would require object restructuring for use with panZoomInstance.update
  readonly noWheelClassName: string;
  readonly noPanClassName: string;
  readonly onPanZoomStart?: OnPanZoom;
  readonly onPanZoom?: OnPanZoom;
  readonly onPanZoomEnd?: OnPanZoom;
  readonly onPaneContextMenu?: (event: MouseEvent) => void;
};

const createZoomable = (
  elem: Accessor<HTMLElement | undefined>,
  params: Accessor<ZoomDirectiveParams>,
) => {
  const { store, setStore } = useSolidFlow();

  const onDraggingChange = (dragging: boolean) => {
    setStore("dragging", dragging);
  };

  const onTransformChange = (transform: Transform) => {
    const [x, y, zoom] = transform;
    setStore("viewport", { x, y, zoom });
  };

  onMount(() => {
    const panZoomInstance = XYPanZoom({
      domNode: elem()!,
      minZoom: store.minZoom,
      maxZoom: store.maxZoom,
      translateExtent: store.translateExtent,
      viewport: params().initialViewport,
      paneClickDistance: params().paneClickDistance,
      onDraggingChange,
      onPanZoomStart: params().onPanZoomStart,
      onPanZoom: params().onPanZoom,
      onPanZoomEnd: params().onPanZoomEnd,
    });

    setStore(
      produce((store) => {
        store.viewport = panZoomInstance.getViewport();
        store.panZoom = panZoomInstance;
      }),
    );

    createEffect(() => {
      panZoomInstance.update({
        lib: store.lib,
        zoomActivationKeyPressed: store.zoomActivationKeyPressed,
        onTransformChange,
        ...params(),
      });
    });
  });
};

export default createZoomable;
