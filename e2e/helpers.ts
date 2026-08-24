import { expect, type Locator, type Page, test as base } from "@playwright/test";

/**
 * Every test fails on any uncaught page error — the harness exists because
 * gesture bugs were invisible to jsdom, and a silent exception mid-gesture
 * is exactly the kind of signal we must not drop.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    await use(page);
    expect(errors, `uncaught page errors: ${errors.map((e) => e.message).join("; ")}`).toEqual([]);
  },
});

export { expect };

/** Navigate to a playground example and wait for the first node to be measured. */
export const gotoExample = async (page: Page, example: string, params = ""): Promise<void> => {
  await page.goto(`/?example=${example}${params}`);
  await expect(page.locator(".solid-flow__node").first()).toHaveCSS("visibility", "visible");
};

export const nodeById = (page: Page, id: string): Locator =>
  page.locator(`.solid-flow__node[data-id="${id}"]`);

/** A node's handle: type is the "source"/"target" class XYHandle matches on. */
export const handleOf = (page: Page, nodeId: string, type: "source" | "target"): Locator =>
  nodeById(page, nodeId).locator(`.solid-flow__handle.${type}`).first();

export const centerOf = async (locator: Locator): Promise<{ x: number; y: number }> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Trusted-input drag in steps (d3 needs move samples, not a teleport). */
export const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
): Promise<void> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
};

/** The flow viewport's pan/zoom, parsed from its CSS transform. */
export const getViewport = (page: Page): Promise<{ x: number; y: number; zoom: number }> =>
  page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>(".solid-flow__viewport");
    if (!viewport) throw new Error("no viewport element");
    const match = viewport.style.transform.match(
      /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/,
    );
    if (!match) throw new Error(`unparseable transform: ${viewport.style.transform}`);
    return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
  });

/** Counts of mounted vs CSS-hidden nodes (the two culling tiers). */
export const nodeRenderCounts = (page: Page): Promise<{ mounted: number; cssHidden: number }> =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".solid-flow__node")];
    return {
      mounted: nodes.length,
      cssHidden: nodes.filter((n) => n.style.visibility === "hidden").length,
    };
  });

/** A point on an SVG path's midpoint, in page (CSS pixel) coordinates. */
export const pathMidpoint = (locator: Locator): Promise<{ x: number; y: number }> =>
  locator.evaluate((el) => {
    const path = el as unknown as SVGPathElement;
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error("path has no screen CTM");
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
  });
