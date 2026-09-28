import { expect, gotoExample, test } from "./helpers";

// Structural rules React Flow / Svelte Flow ship in every stylesheet
// (init.css and Svelte Flow's component styles).
test.describe("structure parity", () => {
  test("the flow lays out left-to-right on a right-to-left page", async ({ page }) => {
    await gotoExample(page, "QuickStart");
    await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
    await expect(page.locator(".solid-flow").first()).toHaveCSS("direction", "ltr");
  });

  test("the focused node-selection box shows no browser outline", async ({ page }) => {
    await gotoExample(page, "QuickStart");
    const outline = await page.evaluate(() => {
      const wrapper = document.createElement("div");
      wrapper.className = "solid-flow__selection-wrapper";
      wrapper.tabIndex = -1;
      document.querySelector(".solid-flow__viewport")!.append(wrapper);
      wrapper.focus();
      return getComputedStyle(wrapper).outlineStyle;
    });
    expect(outline).toBe("none");
  });

  test("the pane takes touch gestures itself (touch-action: none)", async ({ page }) => {
    await gotoExample(page, "QuickStart");
    await expect(page.locator(".solid-flow__pane")).toHaveCSS("touch-action", "none");
  });

  test("a Background's own color wins over the app-wide --xy-background-color", async ({
    page,
  }) => {
    await gotoExample(page, "Edges");
    const bg = await page.evaluate(() => {
      const flow = document.querySelector<HTMLElement>(".solid-flow")!;
      const background = flow.querySelector<HTMLElement>(".solid-flow__background")!;
      flow.style.setProperty("--xy-background-color", "rgb(4, 5, 6)");
      // what <Background bgColor="…"> sets on its element
      background.style.setProperty("--xy-background-color-props", "rgb(1, 2, 3)");
      return getComputedStyle(background).backgroundColor;
    });
    expect(bg).toBe("rgb(1, 2, 3)");
  });

  test("the flow's layer containers are not text-selectable", async ({ page }) => {
    await gotoExample(page, "Edges");
    await expect(page.locator(".solid-flow__edge-labels")).toHaveCSS("user-select", "none");
    await expect(page.locator(".solid-flow__viewport-front")).toHaveCSS("user-select", "none");
  });

  test("<EdgeLabel transparent> drops the label background", async ({ page }) => {
    await gotoExample(page, "Edges");
    const label = page.locator(".solid-flow__edge-label").first();
    // the class <EdgeLabel transparent> renders
    await label.evaluate((el) => el.classList.add("transparent"));
    await expect(label).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });
});
