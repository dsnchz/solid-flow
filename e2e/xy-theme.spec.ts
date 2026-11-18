import { expect, gotoExample, handleOf, nodeById, test } from "./helpers";

// `xy-theme.css`: the shared xyflow theme of React Flow 13 / Svelte Flow 2
// over base.css, with Solid's accent. The playground loads it instead of
// style.css with `&css=xy`.
test.describe("xy-theme.css", () => {
  test("themes nodes, handles, edge labels and the background", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "Edges", "&css=xy");

    await expect(page.locator(".solid-flow").first()).toHaveCSS(
      "background-color",
      "rgb(247, 249, 251)",
    );
    const node = nodeById(page, "2");
    await expect(node).toHaveCSS("border-top", "1px solid rgb(237, 237, 237)");
    await expect(node).toHaveCSS("border-top-left-radius", "8px");
    await expect(node).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(node).toHaveCSS("display", "flex");

    const handle = node.locator(".solid-flow__handle").first();
    await expect(handle).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(handle).toHaveCSS("border-top-color", "rgb(170, 170, 170)");

    const label = page.locator(".solid-flow__edge-label").first();
    await expect(label).toHaveCSS("color", "rgb(80, 80, 80)");
    await expect(label).toHaveCSS("background-color", "rgb(247, 249, 251)");

    await node.click();
    await expect(node).toHaveCSS("border-top-color", "rgb(81, 138, 200)");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(node).toHaveCSS("background-color", "rgb(26, 27, 30)");
  });

  test("a handle that can start or end the connection highlights on hover", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "QuickStart", "&css=xy");
    const source = handleOf(page, "1", "source");
    await expect(source).toHaveCSS("border-top-color", "rgb(170, 170, 170)");
    await source.hover();
    await expect(source).toHaveCSS("border-top-color", "rgb(34, 34, 34)");
    // mid-connection, a valid end highlights
    await page.mouse.down();
    const target = handleOf(page, "2", "target");
    await target.hover();
    await expect(target).toHaveCSS("border-top-color", "rgb(34, 34, 34)");
    await page.mouse.up();
  });

  test("the default stylesheet stays style.css", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "QuickStart");
    await expect(nodeById(page, "1")).toHaveCSS("border-top-left-radius", "3px");
  });
});
