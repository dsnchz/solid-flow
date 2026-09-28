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

  test("forceColorMode overrides the OS preference, and clearing it follows the OS again", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "ColorMode");
    const flow = page.locator(".solid-flow").first();
    await expect(flow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await page.getByLabel("Color mode:").selectOption("dark");
    await expect(flow).toHaveCSS("background-color", "rgb(20, 20, 20)");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByLabel("Color mode:").selectOption("light");
    await expect(flow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await page.getByLabel("Color mode:").selectOption("");
    await expect(flow).toHaveCSS("background-color", "rgb(20, 20, 20)");
  });

  test("a data-theme attribute on an ancestor forces the scheme; forceColorMode wins over it", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "ColorMode");
    const flow = page.locator(".solid-flow").first();

    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await expect(flow).toHaveCSS("background-color", "rgb(20, 20, 20)");

    await page.getByLabel("Color mode:").selectOption("light");
    await expect(flow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("edge labels take the dark theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoExample(page, "Edges");
    const label = page.locator(".solid-flow__edge-label").first();
    await expect(label).toHaveCSS("background-color", "rgb(20, 20, 20)");
    await expect(label).toHaveCSS("color", "rgb(248, 248, 248)");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(label).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });

  test("background patterns use the dark pattern colors", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoExample(page, "Edges");
    // One pattern element per variant under the (dark) flow: the rules, not
    // the Background component, are under test.
    const colors = await page.evaluate(() => {
      const flow = document.querySelector(".solid-flow")!;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      flow.append(svg);
      const read = (variant: string, property: "fill" | "stroke") => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        el.setAttribute("class", `solid-flow__background-pattern ${variant}`);
        svg.append(el);
        return getComputedStyle(el)[property];
      };
      return {
        dots: read("dots", "fill"),
        lines: read("lines", "stroke"),
        cross: read("cross", "stroke"),
      };
    });
    expect(colors).toEqual({
      dots: "rgb(85, 85, 85)",
      lines: "rgb(51, 51, 51)",
      cross: "rgb(51, 51, 51)",
    });
  });
});
