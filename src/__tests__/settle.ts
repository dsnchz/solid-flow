import { flush } from "solid-js";

const SETTLE_ROUNDS = 3;

/**
 * Drains the work a flow defers in jsdom, deterministically, instead of
 * sleeping for a guessed number of milliseconds.
 *
 * What it drains:
 * - Solid's batched writes and effect queue (a microtask): `flush()`;
 * - promise continuations already resolved (async seeds, actions,
 *   `deleteElements`): every microtask runs before a macrotask boundary;
 * - the ResizeObserver stub (setupTests.ts): one entry per observed element
 *   on a `queueMicrotask`, which feeds `requestUpdateNodeInternals`;
 * - `scheduleIdleCallback` (src/browser/idle.ts): `setTimeout(cb, 0)` in
 *   jsdom, which has no `requestIdleCallback` — the node measurement pass;
 * - the overlay release re-check (src/core/overlayRelease.ts): a
 *   `setTimeout(cb, 0)` scheduling boundary.
 *
 * Each round flushes, then yields one `setTimeout(0)` boundary. A 0-delay
 * timer armed before the boundary fires before it (equal delays fire in
 * insertion order); one armed while the round waits fires in the next
 * round. The deepest chain is a mount: its ResizeObserver microtasks arm the
 * measurement timer behind round 0's boundary, so the pass runs in round 1.
 * Instrumenting the suite confirmed it — no 0-delay timer is armed later
 * than round 0 by these schedulers; two rounds pass every test, one does
 * not. The third round is margin for one more link.
 *
 * Not drained: animation frames and timers with a real duration (the
 * MiniMap's 250 ms resample, d3 transitions, double-click intervals) — drive
 * those with fake timers.
 */
export const settle = async () => {
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    flush();
    // A macrotask boundary, not a duration.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  flush();
};
