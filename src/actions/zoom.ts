import {
  type OnPanZoom,
  PanOnScrollMode,
  type Transform,
  type Viewport,
  XYPanZoom,
} from "@xyflow/system";
import { type Accessor } from "solid-js";

import { useSolidFlow } from "@/components/contexts/flow";
import { produce } from "solid-js/store";

export type ZoomDirectiveParams = {
  readonly onPanZoomStart?: OnPanZoom;
  readonly onPanZoom?: OnPanZoom;
  readonly onPanZoomEnd?: OnPanZoom;
  readonly onPaneContextMenu?: (event: MouseEvent) => void;
  readonly onTransformChange: (transform: Transform) => void;
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
};

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      readonly zoom: ZoomDirectiveParams;
    }
  }
}

export default function zoom(domNode: Element, params: Accessor<ZoomDirectiveParams>) {
  const options = params();
  const { store, setStore } = useSolidFlow();

  const setDragging = (dragging: boolean) => {
    setStore("dragging", dragging);
  };

  const panZoomInstance = XYPanZoom({
    domNode,
    minZoom: store.minZoom,
    maxZoom: store.maxZoom,
    translateExtent: store.translateExtent,
    viewport: options.initialViewport,
    paneClickDistance: options.paneClickDistance,
    onDraggingChange: setDragging,
  });

  const currentViewport = panZoomInstance.getViewport();

  setStore(
    produce((store) => {
      store.viewport = currentViewport;
      store.panZoom = panZoomInstance;
    }),
  );

  panZoomInstance.update({
    lib: store.lib,
    zoomActivationKeyPressed: store.zoomActivationKeyPressed,
    ...options,
  });

  return {
    update(params: ZoomDirectiveParams) {
      panZoomInstance.update({
        lib: store.lib,
        zoomActivationKeyPressed: store.zoomActivationKeyPressed,
        ...params,
      });
    },
  };
}
