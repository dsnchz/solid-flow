import { drag, expect, getViewport, gotoExample, test } from "./helpers";

test.describe("pan and zoom", () => {
  test("wheel zooms around the cursor; pane drag pans", async ({ page }) => {
    await gotoExample(page, "Overview");
    const initial = await getViewport(page);

    // Zoom out (Overview's fitView often rests at maxZoom, so zoom-in can
    // legitimately no-op — zoom-out cannot).
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 240);
    await expect.poll(async () => (await getViewport(page)).zoom).toBeLessThan(initial.zoom);

    // Pan on empty pane space (top-left corner of the flow is empty).
    const beforePan = await getViewport(page);
    await drag(page, { x: 200, y: 650 }, { x: 420, y: 520 });
    const afterPan = await getViewport(page);
    expect(afterPan.zoom).toBeCloseTo(beforePan.zoom, 5);
    expect(afterPan.x - beforePan.x).toBeGreaterThan(150);
    expect(afterPan.y - beforePan.y).toBeLessThan(-80);
  });
});
