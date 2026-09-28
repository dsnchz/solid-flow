import { expect, gotoExample, nodeById, test } from "./helpers";

// The theme in a real browser: computed colors, not class names. The Quick
// Start flow sets no color prop, so it follows the OS preference.
test.describe("color scheme", () => {
  test("follows a dark OS preference", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoExample(page, "QuickStart");

    await expect(page.locator(".solid-flow").first()).toHaveCSS(
      "background-color",
      "rgb(20, 20, 20)",
    );
    const node = nodeById(page, "1");
    await expect(node).toHaveCSS("background-color", "rgb(30, 30, 30)");
    await expect(node).toHaveCSS("color", "rgb(248, 248, 248)");
    await expect(page.locator(".solid-flow__edge-path").first()).toHaveCSS(
      "stroke",
      "rgb(62, 62, 62)",
    );
  });

  test("follows a light OS preference; node text inherits the page color", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "QuickStart");

    await expect(page.locator(".solid-flow").first()).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    const node = nodeById(page, "1");
    await expect(node).toHaveCSS("background-color", "rgb(255, 255, 255)");
    // A distinctive page color: inherited text must pick it up (a system
    // color such as CanvasText would stay black).
    await page.addStyleTag({ content: ".solid-flow { color: rgb(1, 2, 3); }" });
    await expect(node).toHaveCSS("color", "rgb(1, 2, 3)");
    await expect(page.locator(".solid-flow__edge-path").first()).toHaveCSS(
      "stroke",
      "rgb(177, 177, 183)",
    );
  });
});
