import { expect, gotoExample, test } from "./helpers";

// A marker without an explicit color takes the edge stroke through CSS
// (React Flow / Svelte Flow): `--xy-edge-stroke`, else the theme default.
// The Edges example's edge e4-13 has `markerEnd: { type: "arrowclosed",
// color: null }`; the example also sets --xy-edge-stroke in a <style>,
// which the test removes to get an app that never sets it.
const defaultMarker = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const path = document.querySelector(
      '.solid-flow__edge[data-id="e4-13"] .solid-flow__edge-path',
    )!;
    const id = /url\(["']?#([^"')]+)/.exec(path.getAttribute("marker-end") ?? "")![1]!;
    const polyline = document.getElementById(id)!.querySelector("polyline")!;
    const cs = getComputedStyle(polyline);
    return { stroke: cs.stroke, fill: cs.fill, edge: getComputedStyle(path).stroke };
  });

for (const scheme of ["light", "dark"] as const) {
  test(`a default-color marker follows the edge stroke (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoExample(page, "Edges");
    await page.evaluate(() =>
      document.querySelectorAll("style").forEach((el) => {
        if (el.textContent?.includes("--xy-edge-stroke: #00ff00")) el.remove();
      }),
    );
    const expected = scheme === "light" ? "rgb(177, 177, 183)" : "rgb(62, 62, 62)";
    await expect
      .poll(() => defaultMarker(page))
      .toEqual({
        stroke: expected,
        fill: expected,
        edge: expected,
      });
  });
}

test("a default-color marker follows --xy-edge-stroke when the app sets it", async ({ page }) => {
  await gotoExample(page, "Edges");
  await expect
    .poll(() => defaultMarker(page))
    .toEqual({
      stroke: "rgb(0, 255, 0)",
      fill: "rgb(0, 255, 0)",
      edge: "rgb(0, 255, 0)",
    });
});
