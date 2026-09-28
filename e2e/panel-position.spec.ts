import { expect, gotoExample, test } from "./helpers";

// Panel positions (React Flow / Svelte Flow): 15px from the edges it
// touches, and truly centered on the axis a `center` position names.
test("panels sit 15px in from their edges and center on their axis", async ({ page }) => {
  await gotoExample(page, "QuickStart");
  const boxes = await page.evaluate(() => {
    const flow = document.querySelector(".solid-flow")!;
    const f = flow.getBoundingClientRect();
    const place = (classes: string) => {
      const el = document.createElement("div");
      el.className = `solid-flow__panel ${classes}`;
      el.style.width = "40px";
      el.style.height = "20px";
      flow.append(el);
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left - f.left),
        top: Math.round(r.top - f.top),
        centerX: Math.round(r.left + r.width / 2 - (f.left + f.width / 2)),
        centerY: Math.round(r.top + r.height / 2 - (f.top + f.height / 2)),
        right: Math.round(f.right - r.right),
        bottom: Math.round(f.bottom - r.bottom),
      };
    };
    return {
      topCenter: place("top center"),
      bottomCenter: place("bottom center"),
      centerLeft: place("center left"),
      centerRight: place("center right"),
      topLeft: place("top left"),
    };
  });
  expect(boxes.topCenter).toMatchObject({ top: 15, centerX: 0 });
  expect(boxes.bottomCenter).toMatchObject({ bottom: 15, centerX: 0 });
  expect(boxes.centerLeft).toMatchObject({ left: 15, centerY: 0 });
  expect(boxes.centerRight).toMatchObject({ right: 15, centerY: 0 });
  expect(boxes.topLeft).toMatchObject({ top: 15, left: 15 });
});
