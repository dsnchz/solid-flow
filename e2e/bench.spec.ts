import { expect, test } from "./helpers";

// Round-12 bench (sidecar composition): per-move listener cost on the hot
// paths the #3085 sidecars touched. Same technique as spike 21: wrap
// pointermove listeners registered after instrumentation (XYDrag/XYHandle
// attach at gesture start) and time each invocation directly.
// Baselines (round 10, dev, headless @10k): connection mean 2.43 / p95 4.5 /
// worst 46.9; node drag with minimap open 16.9 ms/move; round 11 drag
// (prod) 16.5-17.1 ms/move.

const instrument = () => {
  const w = window as unknown as { __evt: number[] };
  w.__evt = [];
  const original = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if ((type === "mousemove" || type === "pointermove") && typeof listener === "function") {
      const wrapped = function (this: unknown, ...args: unknown[]) {
        const t0 = performance.now();
        const result = (listener as (...a: unknown[]) => unknown).apply(this, args);
        w.__evt.push(performance.now() - t0);
        return result;
      };
      return original.call(this, type, wrapped as EventListener, options);
    }
    return original.call(this, type, listener as EventListener, options);
  };
};

const stats = () => {
  const w = window as unknown as { __evt: number[] };
  const s = [...w.__evt].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
  return {
    n: s.length,
    mean: Math.round(mean * 100) / 100,
    p95: Math.round((s[Math.floor(s.length * 0.95)] ?? 0) * 100) / 100,
    worst: Math.round((s[s.length - 1] ?? 0) * 100) / 100,
  };
};

const waitForStress = async (page: import("@playwright/test").Page, params = "") => {
  await page.goto(`/?example=StressTest&x=100&y=100&fit=0${params}`);
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll(".solid-flow__node").length), {
      timeout: 30000,
    })
    .toBeGreaterThan(9000);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => document.visibilityState)).toBe("visible");
};

test("BENCH node drag @10k", async ({ page }) => {
  test.setTimeout(120000);
  await waitForStress(page);
  await page.evaluate(instrument);

  const node = page.locator('.solid-flow__node[data-id="5-5"]');
  const box = (await node.boundingBox())!;
  let x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    x += 3;
    y += 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(5);
  }
  await page.mouse.up();
  console.log("DRAG @10k:", JSON.stringify(await page.evaluate(stats)));
  console.log(
    "DRAG first 6 samples:",
    JSON.stringify(
      await page.evaluate(() =>
        (window as unknown as { __evt: number[] }).__evt
          .slice(0, 6)
          .map((v) => Math.round(v * 10) / 10),
      ),
    ),
  );
});

test("BENCH connection gesture @10k", async ({ page }) => {
  test.setTimeout(120000);
  await waitForStress(page);
  await page.evaluate(instrument);

  const handle = page.locator('.solid-flow__node[data-id="5-5"] .solid-flow__handle.source');
  const box = (await handle.boundingBox())!;
  let x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    x += 3;
    y += 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(5);
  }
  await page.mouse.up();
  console.log("CONNECTION @10k:", JSON.stringify(await page.evaluate(stats)));
});

test("BENCH box selection @10k", async ({ page }) => {
  test.setTimeout(120000);
  await waitForStress(page);
  await page.evaluate(instrument);

  // Shift-drag a growing selection rectangle across the grid.
  await page.keyboard.down("Shift");
  await page.mouse.move(200, 200);
  await page.mouse.down();
  let x = 200;
  let y = 200;
  for (let i = 0; i < 60; i++) {
    x += 12;
    y += 8;
    await page.mouse.move(x, y);
    await page.waitForTimeout(5);
  }
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const selected = await page.evaluate(
    () => document.querySelectorAll(".solid-flow__node.selected").length,
  );
  console.log(
    "BOX SELECT @10k:",
    JSON.stringify(await page.evaluate(stats)),
    "selected:",
    selected,
  );
  expect(selected).toBeGreaterThan(0);
});

test("BENCH selection-mode drag @10k", async ({ page }) => {
  test.setTimeout(120000);
  await waitForStress(page);

  // Box-select a block of nodes first (Pane's listener predates instrumentation,
  // so this part is untimed), then drag the selection wrapper: XYDrag attaches
  // its mousemove listener at gesture start, which the wrapper catches.
  await page.keyboard.down("Shift");
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(600, 500, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const wrapper = page.locator(".solid-flow__selection-wrapper");
  await expect(wrapper).toBeVisible();
  const selected = await page.evaluate(
    () => document.querySelectorAll(".solid-flow__node.selected").length,
  );

  await page.evaluate(instrument);
  const box = (await wrapper.boundingBox())!;
  let x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    x += 3;
    y += 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(5);
  }
  await page.mouse.up();
  console.log(
    "SELECTION DRAG @10k:",
    JSON.stringify(await page.evaluate(stats)),
    "selected:",
    selected,
  );
  expect(selected).toBeGreaterThan(0);
});
