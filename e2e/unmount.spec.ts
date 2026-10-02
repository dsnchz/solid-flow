import { expect, test } from "./helpers";

// An unmounted flow must be collectable: nothing global (the engine's
// queues, window listeners, caches) may keep its tree reachable. Since
// 8ef4e1b made the selected-nodes view lazy, the unmount-time reset read it
// in the disposing flush and left it in the engine's dormant set, keeping
// the whole flow alive until 4de3d19 (bench: 19 -> 276 MB retained at 10k).
//
// It runs against a production build of a bare flow (e2e/unmount/): dev
// builds keep references for their diagnostics, and a SolidFlowProvider
// keeps the flow state alive across an unmount by design. No pointer
// interaction before the unmount: the first event Solid delegates keeps its
// event path reachable through V8's map cache (an upstream candidate).
const FIXTURE = "http://localhost:3012/";

// Tracing pins every DOM element it has seen.
test.use({ trace: "off" });

for (const shape of ["plain", "nested"]) {
  test(`an unmounted flow is garbage-collected (${shape})`, async ({ page }) => {
    await page.goto(`${FIXTURE}?shape=${shape}`);
    await expect(page.locator(".solid-flow__node")).toHaveCount(36);
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll(".solid-flow__edge").length))
      .toBe(35);
    // fully settled, as an app is by the time it unmounts a flow
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __api: { flow: { nodesInitialized: boolean } } }).__api.flow
              .nodesInitialized,
        ),
      )
      .toBe(true);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const w = window as unknown as {
        __flowRef: WeakRef<Element>;
        __fixture: { setMounted: (mounted: boolean) => void; flush: () => void };
      };
      w.__flowRef = new WeakRef(document.querySelector(".solid-flow")!);
      w.__fixture.setMounted(false);
      w.__fixture.flush();
    });
    await expect(page.locator(".solid-flow")).toHaveCount(0);

    // A WeakRef target survives until the task that created it ends: let the
    // page settle, then collect.
    await page.waitForTimeout(100);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    const collected = await page.evaluate(
      () => (window as unknown as { __flowRef: WeakRef<Element> }).__flowRef.deref() === undefined,
    );
    expect(collected).toBe(true);
  });
}
