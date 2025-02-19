import {
  type PanZoomInstance,
  type Viewport,
  XYMinimap,
  type XYMinimapUpdate,
} from "@xyflow/system";
import type { Accessor } from "solid-js";

export type UseInteractiveParams = XYMinimapUpdate & {
  readonly panZoom: PanZoomInstance;
  readonly viewport: Viewport;
  readonly getViewScale: () => number;
};

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      readonly interactive: UseInteractiveParams;
    }
  }
}

export default function interactive(domNode: Element, params: Accessor<UseInteractiveParams>) {
  const minimap = XYMinimap({
    domNode,
    panZoom: params().panZoom,
    getTransform: () => {
      const viewport = params().viewport;
      return [viewport.x, viewport.y, viewport.zoom];
    },
    getViewScale: params().getViewScale,
  });

  function update(params: UseInteractiveParams) {
    minimap.update({
      translateExtent: params.translateExtent,
      width: params.width,
      height: params.height,
      inversePan: params.inversePan,
      zoomStep: params.zoomStep,
      pannable: params.pannable,
      zoomable: params.zoomable,
    });
  }

  return {
    update,
    destroy() {
      minimap.destroy();
    },
  };
}
