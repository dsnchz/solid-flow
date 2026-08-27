import { centerOf, drag, expect, getViewport, gotoExample, handleOf, test } from "./helpers";

// Specs pinning immunity to bugs OPEN (or only recently fixed) upstream in
// React/Svelte Flow. Each names the upstream issue it guards against.
test.describe("upstream-bug immunity", () => {
  test("pan-activation key enables primary-button panning when panOnDrag is off (xyflow#5923)", async ({
    page,
  }) => {
    await gotoExample(page, "Interaction");
    await page
      .locator('input[id="panondrag"], input#panOnDrag')
      .first()
      .uncheck({ force: true })
      .catch(() => {});
    // Fallback: click the checkbox by its label text.
    const checkbox = page.locator("label", { hasText: "panOnDrag" }).locator("input");
    if (await checkbox.isChecked().catch(() => false)) await checkbox.uncheck({ force: true });

    // Control: with panOnDrag off, a plain left-drag must NOT pan.
    const before = await getViewport(page);
    await drag(page, { x: 600, y: 500 }, { x: 450, y: 400 });
    const afterPlain = await getViewport(page);
    expect(afterPlain.x).toBeCloseTo(before.x, 0);

    // Holding the pan-activation key (Space) enables left-button panning.
    await page.keyboard.down(" ");
    await drag(page, { x: 600, y: 500 }, { x: 450, y: 400 });
    await page.keyboard.up(" ");
    const afterKeyed = await getViewport(page);
    expect(Math.abs(afterKeyed.x - afterPlain.x)).toBeGreaterThan(80);
  });

  test("setNodes inside onNodeDrag does not freeze the dragged node (xyflow#4760)", async ({
    page,
  }) => {
    await gotoExample(page, "Intersections");
    const node = page.locator(".solid-flow__node").first();
    const before = await centerOf(node);
    await drag(page, before, { x: before.x + 120, y: before.y + 80 });
    const after = await centerOf(node);
    // Upstream: the node stays visually frozen while state updates behind it.
    expect(after.x - before.x).toBeGreaterThan(80);
    expect(after.y - before.y).toBeGreaterThan(40);
  });
});

test.describe("remount immunity (xyflow#5971, xyflow#5933)", () => {
  test("connections and minimap panning survive a full unmount/remount with the same stores", async ({
    page,
  }) => {
    await gotoExample(page, "Remount");
    await expect(page.locator(".solid-flow__node")).toHaveCount(3);

    await page.getByRole("button", { name: "Unmount flow" }).click();
    await expect(page.locator(".solid-flow__node")).toHaveCount(0);
    await page.getByRole("button", { name: "Remount flow" }).click();
    await expect(page.locator(".solid-flow__node")).toHaveCount(3);

    // Connection dragging still works (upstream dies here under StrictMode
    // remounts until a hard reload).
    const from = await centerOf(handleOf(page, "1", "source"));
    const to = await centerOf(handleOf(page, "3", "target"));
    await drag(page, from, to, 16);
    await expect(page.locator(".solid-flow__edge")).toHaveCount(2);

    // MiniMap panning still works (upstream's minimap goes dead).
    const minimap = page.locator(".solid-flow__minimap-svg");
    const box = (await minimap.boundingBox())!;
    const before = await getViewport(page);
    await drag(
      page,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      { x: box.x + box.width / 2 - 30, y: box.y + box.height / 2 - 20 },
      8,
    );
    const after = await getViewport(page);
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(20);
  });
});
