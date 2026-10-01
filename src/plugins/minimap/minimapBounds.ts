import { getBoundsOfRects, type Rect, type Viewport } from "@xyflow/system";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";

import { createGraphBoundsSampler } from "@/core/graphBounds";
import type { NodeGeometry } from "@/core/projections/internalNodes";

/** The longest an idle-time geometry change waits to reach the minimap's bounds. */
const RESAMPLE_MS = 250;

export type MinimapBoundsSource = {
  readonly store: {
    readonly dragging: boolean;
    readonly nodes: readonly unknown[];
    readonly nodesInitialized: boolean;
    readonly viewport: Viewport;
    readonly width: number;
    readonly height: number;
  };
  /** Every node's absolute rect: a plain map, read by the sampler only. */
  readonly geometry: ReadonlyMap<string, NodeGeometry>;
  /** Ticks whenever a row's geometry changes. */
  readonly geometryChanges: Accessor<number>;
  /** The drag sidecar: its keys are the dragged node ids. */
  readonly dragOverlay: object;
};

const rectsEqual = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

/**
 * What the minimap must show: the graph's bounds, SAMPLED from the plain
 * geometry map, joined with the visible viewport (`viewBB`, in flow
 * coordinates) as `boundingRect`.
 */
export const createMinimapBounds = ({
  store,
  geometry,
  geometryChanges,
  dragOverlay,
}: MinimapBoundsSource) => {
  // B1 (audit, bench round 7): every value below was an unmemoized helper
  // chain — the viewBox and mask-path expressions re-ran the FULL O(n)
  // getInternalNodesBounds scan ~30 times per drag/pan frame, which froze
  // the tab outright at 10k nodes (1.5s per mousemove at 2.5k). One memo
  // per level: exactly one bounds scan per graph/viewport change.
  const viewBB = createMemo(() => ({
    x: -store.viewport.x / store.viewport.zoom,
    y: -store.viewport.y / store.viewport.zoom,
    width: store.width / store.viewport.zoom,
    height: store.height / store.viewport.zoom,
  }));

  // Graph bounds are SAMPLED, not tracked (bench round 7's residual): a
  // tracked memo re-ran the O(n) bounds scan through the reactive lookup on
  // every position write during a drag. Round 15 made the sample itself
  // cheap: while dragging, the core sampler partitions the graph once per
  // dragged set and unions only the MOVING rows per animation frame (a full
  // pass reads ~7 proxy leaves per row — ~38ms @10k headless — and used to
  // run every frame AND every 500ms forever). Idle re-samples are driven by
  // the geometry feed's tick (bumped when any row's derive lands a new
  // position/size), at most every RESAMPLE_MS — no timer and no scan while
  // the graph is still.
  const sampler = createGraphBoundsSampler({
    geometry,
    draggedIds: () => new Set(Object.keys(dragOverlay)),
  });
  const sample = (dragging: boolean) => untrack(() => sampler.sample(dragging));
  const [graphBounds, setGraphBounds] = createSignal<Rect | null>(sample(false), {
    equals: rectsEqual,
  });
  let resample: ReturnType<typeof setTimeout> | undefined;
  const cancelResample = () => {
    clearTimeout(resample);
    resample = undefined;
  };
  onCleanup(cancelResample);

  createEffect(
    () => store.dragging,
    (dragging) => {
      if (!dragging) {
        cancelResample();
        setGraphBounds(sample(false));
        return;
      }
      let raf = requestAnimationFrame(function tick() {
        setGraphBounds(sample(true));
        raf = requestAnimationFrame(tick);
      });
      return () => cancelAnimationFrame(raf);
    },
  );
  createEffect(
    () => ({ count: store.nodes.length, initialized: store.nodesInitialized }),
    () => {
      cancelResample();
      setGraphBounds(sample(false));
    },
  );
  // Geometry changes outside a drag (programmatic moves, user draft writes,
  // resizes): one trailing full pass per RESAMPLE_MS window, armed by the
  // first change in it. A drag samples per frame above instead.
  createEffect(
    () => geometryChanges(),
    () => {
      if (resample !== undefined || untrack(() => store.dragging)) return;
      resample = setTimeout(() => {
        resample = undefined;
        setGraphBounds(sample(false));
      }, RESAMPLE_MS);
    },
  );

  // Value-equal cut: while the viewport stays inside the graph's bounds,
  // every pan or zoom recomputes the same union — without it each run was a
  // fresh object and scale, viewBox and mask re-ran for nothing
  // (UNSTABLE_MEMO_OUTPUT in the dev runtime).
  const boundingRect = createMemo(
    () => {
      const view = viewBB();
      const bounds = graphBounds();
      return bounds ? getBoundsOfRects(bounds, view) : view;
    },
    { equals: rectsEqual, name: "boundingRect" },
  );

  return { viewBB, boundingRect };
};
