import { expect, gotoExample, nodeById, test } from "./helpers";

// NodeResizer handles (React Flow / Svelte Flow): 5px, centered on the
// node's corner, and still centered when autoScale enlarges them on a
// zoomed-out viewport (the scale must not shift the centering translate).
test("resize handles stay centered on their corners when zoomed out", async ({ page }) => {
  await gotoExample(page, "NodeResizer");
  const node = nodeById(page, "1");
  await node.click();
  const handle = node.locator(".solid-flow__resize-control.handle.top.left");
  await expect(handle).toHaveCSS("width", "5px");

  // zoom out so autoScale enlarges the handles (scale = 1 / zoom)
  const pane = page.locator(".solid-flow__pane");
  const box = (await pane.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 200);
  await expect
    .poll(async () => Number(await handle.evaluate((el) => getComputedStyle(el).scale)))
    .toBeGreaterThan(1.5);

  const offset = await page.evaluate(() => {
    const node = document.querySelector('.solid-flow__node[data-id="1"]')!.getBoundingClientRect();
    const h = document
      .querySelector('.solid-flow__node[data-id="1"] .solid-flow__resize-control.handle.top.left')!
      .getBoundingClientRect();
    return { dx: h.left + h.width / 2 - node.left, dy: h.top + h.height / 2 - node.top };
  });
  expect(Math.abs(offset.dx)).toBeLessThan(0.75);
  expect(Math.abs(offset.dy)).toBeLessThan(0.75);
});
