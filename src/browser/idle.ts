/**
 * Schedules a callback during idle time, falling back to a macrotask where
 * `requestIdleCallback` is unavailable (Safari, jsdom).
 */
/**
 * Upper bound on how long the measurement ingest may wait for idle time.
 * Under continuous input (a NodeResizer drag, live-data resizes) idle time
 * can be starved, and without a timeout edges lag the resizing node for as
 * long as the input keeps coming. Two frames keeps the lag invisible.
 */
const IDLE_TIMEOUT_MS = 32;
export const scheduleIdleCallback: (callback: () => void) => void =
  typeof requestIdleCallback === "function"
    ? (callback) => requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS })
    : (callback) => setTimeout(callback, 0);
