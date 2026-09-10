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

test.describe("pan cursor cover", () => {
  test("appears only while a pan is held, never on a plain click", async ({ page }) => {
    await page.goto("/?example=StressTest&x=6&y=6");
    await page.waitForSelector(".solid-flow__node");
    const cover = page.locator(".solid-flow__pan-cursor");
    const pane = page.locator(".solid-flow__pane");
    const box = (await pane.boundingBox())!;
    const x = box.x + box.width - 30;
    const y = box.y + box.height - 30;
    // a click starts and ends a d3-zoom gesture without moving: no cover
    await page.mouse.click(x, y);
    await expect(cover).toHaveCount(0);
    // a held pan: cover after the first move, gone after release
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(cover).toHaveCount(0);
    await page.mouse.move(x - 40, y - 20, { steps: 4 });
    await expect(cover).toHaveCount(1);
    await expect(cover).toHaveCSS("cursor", "grabbing");
    await page.mouse.up();
    await expect(cover).toHaveCount(0);
  });
});
