// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The measurement ingest is idle-scheduled; without a timeout, continuous
 * input (a NodeResizer drag, live-data resizes) can starve it so edges lag a
 * resizing node indefinitely. The scheduler must bound the wait.
 */
describe("scheduleIdleCallback", () => {
  afterEach(() => {
    vi.resetModules();
    delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  it("passes a bounded timeout to requestIdleCallback", async () => {
    const ric = vi.fn();
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = ric;
    const { scheduleIdleCallback } = await import("../utils");
    const cb = () => {};
    scheduleIdleCallback(cb);
    expect(ric).toHaveBeenCalledTimes(1);
    const [, options] = ric.mock.calls[0]!;
    expect(options).toEqual({ timeout: expect.any(Number) });
    expect((options as { timeout: number }).timeout).toBeLessThanOrEqual(50);
  });

  it("falls back to a macrotask where requestIdleCallback is missing", async () => {
    const { scheduleIdleCallback } = await import("../utils");
    await new Promise<void>((resolve) => scheduleIdleCallback(resolve));
  });
});
