import { centerOf, drag, expect, gotoExample, nodeById, test } from "./helpers";

test.describe("node drag", () => {
  test("moves the node and re-routes its edges live", async ({ page }) => {
    await gotoExample(page, "Overview");

    const node = nodeById(page, "2");
    const before = await centerOf(node);
    const edgePath = page.locator('.solid-flow__edge[data-id="1-2"] .solid-flow__edge-path');
    const pathBefore = await edgePath.getAttribute("d");

    // Drag up-right, AWAY from the viewport edges (approaching an edge
    // triggers autopan, which shifts the viewport under the cursor).
    await drag(page, before, { x: before.x + 140, y: before.y - 90 });

    // Overview snaps to a [25, 25] flow grid, so the landed position is
    // quantized: assert substantial movement, not exact deltas (25 flow
    // units is ~32 screen px at this fitView zoom).
    const after = await centerOf(node);
    expect(after.x - before.x).toBeGreaterThan(90);
    expect(after.y - before.y).toBeLessThan(-40);

    // The attached edge followed within the same gesture.
    expect(await edgePath.getAttribute("d")).not.toBe(pathBefore);
  });

  test("a node dragged again after a zoom still follows the pointer", async ({ page }) => {
    // Each node's drag controller keeps one store-items object for its
    // lifetime (createDraggable): every field must be read live, or the
    // second drag would convert pointer motion with the first drag's zoom.
    await gotoExample(page, "QuickStart");
    const node = nodeById(page, "2");
    // XYDrag starts the drag at the move that crosses nodeDragThreshold and
    // takes that pointer position as its origin, so the node trails the
    // pointer by that first step: cross it with a 2 px nudge.
    const follow = async (dx: number, dy: number) => {
      const from = await centerOf(node);
      const to = { x: from.x + dx, y: from.y + dy };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 2, from.y);
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await page.mouse.up();
      const landed = await centerOf(node);
      expect(Math.abs(landed.x - to.x)).toBeLessThan(3);
      expect(Math.abs(landed.y - to.y)).toBeLessThan(3);
    };
    await follow(60, 40);
    // Zoom OUT: QuickStart fits the view at maxZoom, so zooming in is a no-op
    // and the test would pass vacuously. Assert the camera really changed.
    const viewport = page.locator(".solid-flow__viewport");
    const cameraBefore = await viewport.getAttribute("style");
    const pane = await centerOf(page.locator(".solid-flow__pane"));
    await page.mouse.move(pane.x, pane.y);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    expect(await viewport.getAttribute("style")).not.toBe(cameraBefore);
    await follow(60, 40);
  });
});
