import { createEffect, untrack } from "solid-js";

export type InitialFitViewSource = {
  /** The container is measured and pan-zoom is mounted. Tracked by the effect. */
  readonly ready: () => boolean;
  readonly fitView: () => unknown;
};

/**
 * The `fitView` prop's initial fit. It needs both the measured nodes (the
 * first measuring pass, reported through markNodesMeasured) and a ready
 * container (dimensions from the resize observer, the pan-zoom instance).
 * Their order is not guaranteed, so whichever lands last fires it, once.
 * The flow arms it on mount with the prop's value.
 */
export const createInitialFitView = (source: InitialFitViewSource) => {
  let applied = false;
  let nodesMeasured = false;

  const tryFit = () => {
    if (applied || !nodesMeasured) return;
    if (!untrack(source.ready)) return;

    applied = true;
    void untrack(source.fitView);
  };

  // The measured nodes arrive imperatively (markNodesMeasured); this covers
  // the container side arriving last.
  createEffect(
    () => source.ready(),
    (ready) => {
      if (ready) tryFit();
    },
  );

  return {
    /** Arms the initial fit with the `fitView` prop: false never fits. */
    arm: (fitView: boolean) => {
      applied = !fitView;
    },
    /** Marks the first measuring pass complete (may fire the fit). */
    markNodesMeasured: () => {
      nodesMeasured = true;
      tryFit();
    },
  };
};
