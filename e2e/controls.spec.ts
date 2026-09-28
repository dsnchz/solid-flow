import { expect, gotoExample, test } from "./helpers";

// Controls (React Flow / Svelte Flow): vertical buttons are separated by a
// bottom border, horizontal ones (`orientation="horizontal"`, which sets the
// `horizontal` class) by a right border, and the last button has none.
test("horizontal controls separate buttons with a right border", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await gotoExample(page, "QuickStart");
  const controls = page.locator(".solid-flow__controls");
  const buttons = controls.locator(".solid-flow__controls-button");
  await expect(buttons.first()).toHaveCSS("border-bottom", "1px solid rgb(238, 238, 238)");
  await expect(buttons.first()).toHaveCSS("border-right-width", "0px");

  await controls.evaluate((el) => el.classList.add("horizontal"));
  await expect(buttons.first()).toHaveCSS("border-bottom-width", "0px");
  await expect(buttons.first()).toHaveCSS("border-right", "1px solid rgb(238, 238, 238)");
  await expect(buttons.last()).toHaveCSS("border-right-width", "0px");
});

test("only control buttons get the control-button styles", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await gotoExample(page, "QuickStart");
  // an app's own <button> inside <Controls> is not a ControlButton
  const plain = await page.locator(".solid-flow__controls").evaluate((el) => {
    const button = document.createElement("button");
    button.textContent = "app";
    el.append(button);
    const cs = getComputedStyle(button);
    return { width: cs.width, background: cs.backgroundColor, display: cs.display };
  });
  expect(plain.width).not.toBe("26px");
  expect(plain.background).not.toBe("rgb(254, 254, 254)");
  expect(plain.display).not.toBe("flex");
  await expect(page.locator(".solid-flow__controls-button").first()).toHaveCSS("width", "26px");
});
