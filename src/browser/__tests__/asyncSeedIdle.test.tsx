import { render } from "@solidjs/testing-library";
import { Loading } from "@solidjs/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createNodeStore } from "@/core";

import { SolidFlow } from "../../components/SolidFlow";

type SeedNode = {
  id: string;
  type: "default";
  position: { x: number; y: number };
  data: { label: string };
};

// The browser layer schedules idle work (selection-view priming, measurement
// ingest) on plain timers, outside any reactive owner. An untracked read of
// a still-pending async-seeded store throws NotReadyError with nothing to
// catch it — an uncaught error in the browser, and in vitest an unhandled
// error whose attached engine node the reporter cannot serialize (the CI
// heap OOM). Fake timers make the timer callback run inside the test, so a
// throwing callback fails here instead of escaping the run.
describe("idle work while an async-seeded store is pending", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not throw when the idle timers fire before the store resolves", async () => {
    vi.useFakeTimers();
    const [nodes] = createNodeStore(() => new Promise<SeedNode[]>(() => undefined));

    const { container } = render(() => (
      <Loading fallback={<div data-testid="loading">loading…</div>}>
        <SolidFlow nodes={nodes} edges={[]} width={800} height={600} />
      </Loading>
    ));
    await Promise.resolve();
    expect(container.querySelector('[data-testid="loading"]')).not.toBeNull();

    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
  });
});
