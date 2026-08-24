import { expect, gotoExample, nodeRenderCounts, test } from "./helpers";

// StressTest grid: 625 nodes, fit=0 leaves the grid overflowing the viewport
// so both culling tiers have something to cull.
test.describe("viewport culling", () => {
  test("CSS tier (default): everything mounted, off-viewport nodes hidden; flips on fitView", async ({
    page,
  }) => {
    await gotoExample(page, "StressTest", "&fit=0");

    await expect.poll(async () => (await nodeRenderCounts(page)).mounted).toBe(625);
    await expect.poll(async () => (await nodeRenderCounts(page)).cssHidden).toBeGreaterThan(0);

    // fitView brings the whole grid into view: hidden count must drop to 0
    // without any node ever unmounting.
    await page.locator(".solid-flow__controls-fitview").click();
    await expect.poll(async () => (await nodeRenderCounts(page)).cssHidden).toBe(0);
    expect((await nodeRenderCounts(page)).mounted).toBe(625);
  });

  test("unmount tier (onlyRenderVisibleElements): off-viewport nodes unmount and remount", async ({
    page,
  }) => {
    await gotoExample(page, "StressTest", "&fit=0&unmount=1");

    // Partially mounted, nothing CSS-hidden (hidden ones are not in the DOM).
    await expect.poll(async () => (await nodeRenderCounts(page)).mounted).toBeLessThan(625);
    const partial = await nodeRenderCounts(page);
    expect(partial.mounted).toBeGreaterThan(0);
    expect(partial.cssHidden).toBe(0);

    // fitView: every node REMOUNTS (and renders measured, not as a flash of
    // unmeasured rows — cached measurements survive disposal).
    await page.locator(".solid-flow__controls-fitview").click();
    await expect.poll(async () => (await nodeRenderCounts(page)).mounted).toBe(625);
    expect((await nodeRenderCounts(page)).cssHidden).toBe(0);

    // Zoom back in: the mounted set shrinks again — the tier stays live.
    // fitView rests around zoom 0.46 for this grid; the culling rect is
    // bucketed to powers of two with 0.5 overscan, so it takes several
    // wheel ticks before the rect stops covering the whole grid.
    await page.mouse.move(640, 400);
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -240);
    }
    await expect.poll(async () => (await nodeRenderCounts(page)).mounted).toBeLessThan(625);
  });
});
