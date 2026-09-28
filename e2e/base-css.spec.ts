import { expect, gotoExample, nodeById, test } from "./helpers";

// `base.css`: the structural rules with the minimal theme (React Flow /
// Svelte Flow's base.css), for apps that bring their own skin. The
// playground loads it instead of style.css with `&css=base`.
test.describe("base.css", () => {
  test("keeps the flow working and applies only the minimal skin", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "QuickStart", "&css=base");
    const node = nodeById(page, "1");

    // structure: nodes and handles laid out as with style.css
    await expect(node).toHaveCSS("position", "absolute");
    const handle = node.locator(".solid-flow__handle").first();
    await expect(handle).toHaveCSS("position", "absolute");
    await expect(handle).toHaveCSS("min-width", "5px");
    await expect(page.locator(".solid-flow__edge-path").first()).toHaveCSS(
      "stroke",
      "rgb(177, 177, 183)",
    );

    // the minimal skin: a neutral border, no fill, a plain handle
    await expect(node).toHaveCSS("border-top", "1px solid rgb(187, 187, 187)");
    await expect(node).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(node).toHaveCSS("padding-top", "0px");
    await expect(handle).toHaveCSS("background-color", "rgb(51, 51, 51)");
    await expect(handle).toHaveCSS("border-top-left-radius", "0px");

    await node.click();
    await expect(node).toHaveCSS("border-top", "1px solid rgb(85, 85, 85)");
  });

  test("style.css adds the default theme over the same structure", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "QuickStart");
    const node = nodeById(page, "1");
    await expect(node).toHaveCSS("border-top", "1px solid rgb(26, 25, 43)");
    await expect(node).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(node).toHaveCSS("padding-top", "10px");
    await expect(node.locator(".solid-flow__handle").first()).toHaveCSS(
      "border-top-left-radius",
      "100%",
    );
  });
});
