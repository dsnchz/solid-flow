import { expect, test } from "./helpers";
type W = {
  __bench: {
    DEV: {
      attribution: {
        costs(): {
          scopes: { name: string; kind: string; runs: number; selfMs: number; wastedMs: number }[];
          writes: { name: string; runs: number; downstreamMs: number }[];
        };
      };
    };
  };
};
test("PROBE attribution on a 30x30 stress load + drag", async ({ page }) => {
  test.setTimeout(120000);
  const warns: string[] = [];
  const fullWarns: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "warning") {
      warns.push(m.text().split("\n")[0]!);
      fullWarns.push(m.text());
    }
  });
  await page.goto(`/?example=StressTest&x=30&y=30&fit=0&minimap=1&attr=1`);
  await expect(page.locator(".solid-flow__node").first()).toBeVisible();
  await page.waitForTimeout(1500);
  const uniq = [...new Set(warns.map((w) => w.replace(/\d+/g, "N")))];
  for (const u of uniq) console.log("WARN:", u.slice(0, 200));
  for (const w of fullWarns) {
    if (/HUGE_FAN_IN\] Computation "(computed|effect)"/.test(w)) {
      console.log("ANON:", w.replace(/\n/g, " ⏎ ").slice(0, 900));
    }
  }
  const dump = async (label: string) => {
    const c = await page.evaluate(() => {
      const { scopes, writes } = (window as unknown as W).__bench.DEV.attribution.costs();
      const top = (arr: typeof scopes, key: "selfMs" | "runs") =>
        [...arr]
          .sort((a, b) => b[key] - a[key])
          .slice(0, 10)
          .map(
            (s) =>
              `${s.kind} ${s.name} runs=${s.runs} self=${s.selfMs.toFixed(1)} waste=${s.wastedMs.toFixed(1)}`,
          );
      return {
        bySelf: top(scopes, "selfMs"),
        byRuns: top(scopes, "runs"),
        writes: [...writes]
          .sort((a, b) => b.downstreamMs - a.downstreamMs)
          .slice(0, 6)
          .map((w) => `${w.name} runs=${w.runs} downstream=${w.downstreamMs.toFixed(1)}`),
        n: scopes.length,
      };
    });
    console.log(`COSTS ${label} scopes=${c.n}`);
    for (const l of c.bySelf) console.log(`  SELF ${l}`);
    for (const l of c.byRuns) console.log(`  RUNS ${l}`);
    for (const l of c.writes) console.log(`  WRITE ${l}`);
  };
  await dump("after-load");
  const node = page.locator('.solid-flow__node[data-id="5-5"]');
  const box = (await node.boundingBox())!;
  let x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 30; i++) {
    x += 3;
    y += 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(5);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  await dump("after-drag");
});
