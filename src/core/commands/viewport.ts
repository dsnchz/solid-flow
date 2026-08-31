import {
  type CoordinateExtent,
  fitViewport,
  getViewportForBounds,
  type NodeLookup,
  panBy as panBySystem,
  type PanZoomInstance,
  pointToRendererPoint,
  rendererPointToPoint,
  type SetCenterOptions,
  type SnapGrid,
  type Transform,
  type Viewport,
  type ViewportHelperFunctionOptions,
} from "@xyflow/system";

import type { Edge, FitViewOptions, InternalNode, Node } from "@/types";

import type { FlowCommands } from "../flowState";

/** The slice of the internal store the viewport commands read. */
type ViewportStoreReads = {
  readonly panZoom: PanZoomInstance | null;
  readonly domNode: HTMLDivElement | null;
  readonly width: number;
  readonly height: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly viewport: Viewport;
  readonly snapGrid?: SnapGrid;
  readonly transform: Transform;
  readonly translateExtent: CoordinateExtent;
};

export type ViewportCommandDeps<NodeType extends Node> = {
  readonly store: ViewportStoreReads;
  readonly nodeLookup: NodeLookup<InternalNode<NodeType>>;
  /** The flow-level `fitViewOptions` prop, used when `fitView()` gets no argument. */
  readonly defaultFitViewOptions: () => FitViewOptions<NodeType> | undefined;
};

/**
 * Viewport command group: every camera movement (fit, zoom, center, pan) and
 * the screen<->flow coordinate conversions. All of it is pull-based delegation
 * to the panZoom instance / the current transform — no graph writes.
 */
export const createViewportCommands = <NodeType extends Node, EdgeType extends Edge>({
  store,
  nodeLookup,
  defaultFitViewOptions,
}: ViewportCommandDeps<NodeType>) => {
  const fitView = async (options?: FitViewOptions<NodeType>) => {
    if (!store.panZoom) return false;

    const result = await fitViewport(
      {
        nodes: nodeLookup,
        width: store.width,
        height: store.height,
        panZoom: store.panZoom,
        minZoom: store.minZoom,
        maxZoom: store.maxZoom,
      },
      options ?? defaultFitViewOptions(),
    );

    return result;
  };

  const zoomBy = async (factor: number, options?: ViewportHelperFunctionOptions) => {
    return store.panZoom ? store.panZoom.scaleBy(factor, options) : false;
  };

  const zoomIn = (options?: ViewportHelperFunctionOptions) => zoomBy(1.2, options);
  const zoomOut = (options?: ViewportHelperFunctionOptions) => zoomBy(1 / 1.2, options);

  const setCenter = async (x: number, y: number, options?: SetCenterOptions) => {
    const nextZoom = typeof options?.zoom !== "undefined" ? options.zoom : store.maxZoom;
    const currentPanZoom = store.panZoom;

    if (!currentPanZoom) {
      return Promise.resolve(false);
    }

    await currentPanZoom.setViewport(
      {
        x: store.width / 2 - x * nextZoom,
        y: store.height / 2 - y * nextZoom,
        zoom: nextZoom,
      },
      { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate },
    );

    return Promise.resolve(true);
  };

  const panBy = (delta: { x: number; y: number }) => {
    return panBySystem({
      delta,
      panZoom: store.panZoom,
      transform: store.transform,
      translateExtent: store.translateExtent,
      width: store.width,
      height: store.height,
    });
  };

  const commands = {
    fitView,
    fitBounds: async (bounds, options) => {
      if (!store.panZoom) return false;

      const viewport = getViewportForBounds(
        bounds,
        store.width,
        store.height,
        store.minZoom,
        store.maxZoom,
        options?.padding ?? 0.1,
      );

      await store.panZoom.setViewport(viewport, {
        duration: options?.duration,
        ease: options?.ease,
        interpolate: options?.interpolate,
      });

      return true;
    },
    zoomIn,
    zoomOut,
    setZoom: (zoomLevel, options) => {
      const currentPanZoom = store.panZoom;
      return currentPanZoom
        ? currentPanZoom.scaleTo(zoomLevel, { duration: options?.duration })
        : Promise.resolve(false);
    },
    setCenter,
    setViewport: async (nextViewport, options) => {
      const currentViewport = store.viewport;

      if (!store.panZoom) return false;

      await store.panZoom.setViewport(
        {
          x: nextViewport.x ?? currentViewport.x,
          y: nextViewport.y ?? currentViewport.y,
          zoom: nextViewport.zoom ?? currentViewport.zoom,
        },
        options,
      );

      return true;
    },
    panBy,
    screenToFlowPosition: (position, options = { snapToGrid: true }) => {
      if (!store.domNode) return position;

      const _snapGrid = options.snapToGrid ? store.snapGrid : false;
      const { x, y, zoom } = store.viewport;
      const { x: domX, y: domY } = store.domNode.getBoundingClientRect();
      const correctedPosition = {
        x: position.x - domX,
        y: position.y - domY,
      };

      return pointToRendererPoint(
        correctedPosition,
        [x, y, zoom],
        !!_snapGrid,
        _snapGrid || [1, 1],
      );
    },
    flowToScreenPosition: (position) => {
      if (!store.domNode) return position;

      const { x, y, zoom } = store.viewport;
      const { x: domX, y: domY } = store.domNode.getBoundingClientRect();
      const rendererPosition = rendererPointToPoint(position, [x, y, zoom]);

      return {
        x: rendererPosition.x + domX,
        y: rendererPosition.y + domY,
      };
    },
  } satisfies Partial<FlowCommands<NodeType, EdgeType>>;

  return { ...commands, zoomBy } as const;
};
