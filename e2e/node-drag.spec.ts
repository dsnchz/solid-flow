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
});
