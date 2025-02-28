import {
  fitView,
  type FitViewOptionsBase,
  getDimensions,
  getFitViewNodes,
  getViewportForBounds,
  type PanZoomTransformOptions,
  pointToRendererPoint,
  type Rect,
  rendererPointToPoint,
  type SnapGrid,
  type Transform,
  type Viewport,
  type XYPosition,
} from "@xyflow/system";

import { useSolidFlow } from "@/components/contexts/flow";

type PanZoomOptionsWithPadding = PanZoomTransformOptions & { readonly padding?: number };
type PanZoomOptionsWithZoom = PanZoomTransformOptions & { readonly zoom?: number };

/**
 * Hook for getting viewport helper functions.
 *
 * @internal
 * @returns viewport helper functions
 */
const useViewport = () => {
  const { store } = useSolidFlow();

  return {
    viewport: () => store.viewport,
    zoomIn: (options: PanZoomTransformOptions) => {
      return store.panZoom ? store.panZoom.scaleBy(1.2, options) : Promise.resolve(false);
    },
    zoomOut: (options: PanZoomTransformOptions) => {
      return store.panZoom ? store.panZoom.scaleBy(1 / 1.2, options) : Promise.resolve(false);
    },
    zoomTo: (zoomScale: number, options: PanZoomTransformOptions) => {
      return store.panZoom ? store.panZoom.scaleTo(zoomScale, options) : Promise.resolve(false);
    },
    setViewport: async (viewport: Viewport, options: PanZoomTransformOptions) => {
      const { x: tX, y: tY, zoom: tZoom } = store.viewport;

      if (!store.panZoom) return Promise.resolve(false);

      const _viewport = {
        x: viewport.x ?? tX,
        y: viewport.y ?? tY,
        zoom: viewport.zoom ?? tZoom,
      };

      await store.panZoom.setViewport(_viewport, options);

      return Promise.resolve(true);
    },
    fitView: (options: FitViewOptionsBase) => {
      if (!store.panZoom || !store.domNode) return Promise.resolve(false);

      const fitViewNodes = getFitViewNodes(store.nodeLookup, options);
      const { width, height } = getDimensions(store.domNode);

      return fitView(
        {
          nodes: fitViewNodes,
          width,
          height,
          minZoom: store.minZoom,
          maxZoom: store.maxZoom,
          panZoom: store.panZoom,
        },
        options,
      );
    },
    setCenter: async (x: number, y: number, options: PanZoomOptionsWithZoom) => {
      const { zoom, ...panZoomOptions } = options;

      const nextZoom = typeof zoom !== "undefined" ? zoom : store.maxZoom;
      const centerX = store.width / 2 - x * nextZoom;
      const centerY = store.height / 2 - y * nextZoom;

      if (!store.panZoom) return Promise.resolve(false);

      await store.panZoom.setViewport(
        {
          x: centerX,
          y: centerY,
          zoom: nextZoom,
        },
        panZoomOptions,
      );

      return Promise.resolve(true);
    },
    fitBounds: async (bounds: Rect, options: PanZoomOptionsWithPadding) => {
      const { padding = 0.1, ...panZoomOptions } = options;

      const viewport = getViewportForBounds(
        bounds,
        store.width,
        store.height,
        store.minZoom,
        store.maxZoom,
        padding,
      );

      if (!store.panZoom) return Promise.resolve(false);

      await store.panZoom.setViewport(viewport, panZoomOptions);

      return Promise.resolve(true);
    },
    screenToFlowPosition: (
      clientPosition: XYPosition,
      options: { snapToGrid?: boolean; snapGrid?: SnapGrid } = {},
    ) => {
      if (!store.domNode) return clientPosition;

      const { x: domX, y: domY } = store.domNode.getBoundingClientRect();
      const correctedPosition = { x: clientPosition.x - domX, y: clientPosition.y - domY };
      const snapGrid = options.snapGrid ?? store.snapGrid;
      const snapToGrid = options.snapToGrid ?? store.snapToGrid;
      const transform = [store.viewport.x, store.viewport.y, store.viewport.zoom] as Transform;

      return pointToRendererPoint(correctedPosition, transform, snapToGrid, snapGrid);
    },
    flowToScreenPosition: (flowPosition: XYPosition) => {
      if (!store.domNode) return flowPosition;

      const { x: domX, y: domY } = store.domNode.getBoundingClientRect();
      const transform = [store.viewport.x, store.viewport.y, store.viewport.zoom] as Transform;
      const rendererPosition = rendererPointToPoint(flowPosition, transform);

      return {
        x: rendererPosition.x + domX,
        y: rendererPosition.y + domY,
      } as const;
    },
  } as const;
};

export default useViewport;
