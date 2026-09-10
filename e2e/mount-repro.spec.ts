import { expect, test } from "./helpers";

/**
 * Drives .agent/spikes/p34-markheap-mount/minimal (standalone Solid app, no Solid
 * Flow) served on :3010: mount time vs N for the query-string configurations listed below,
 * plus a CDP profile at the largest N. Opt-in: BENCH=1.
 */
const sizes = [1000, 2000, 4000, 8000, 16000];

const configs = [""];
for (const shared of configs) {
  test(`REPRO mount scaling ${shared || "(plain)"}`, async ({ page }) => {
    test.setTimeout(300000);
    const rows: { n: number; ms: number }[] = [];
    for (const n of sizes) {
      await page.goto(`/?n=${n}${shared}`);
      const ms = await page.evaluate(() => (window as unknown as { __mount: number }).__mount);
      rows.push({ n, ms });
    }
    console.log(`SCALING ${shared || "(plain)"}`);
    rows.forEach(({ n, ms }, i) =>
      console.log(
        `  N=${String(n).padStart(5)} ${ms.toFixed(0).padStart(7)} ms ${((ms / n) * 1000).toFixed(0).padStart(5)} us/row${i ? `  ${(ms / rows[i - 1]!.ms).toFixed(2)}x per 2x N` : ""}`,
      ),
    );
    expect(rows.at(-1)!.ms).toBeGreaterThan(0);
  });
}

test("REPRO profile at N=8000, refEffects=4", async ({ page }) => {
  test.setTimeout(300000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 250 });
  await cdp.send("Profiler.start");
  await page.goto(`/?n=8000`);
  const { profile } = await cdp.send("Profiler.stop");
  const self = new Map<string, number>();
  const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas ?? [];
  let total = 0;
  (profile.samples ?? []).forEach((id, i) => {
    const fn = nodeById.get(id)!.callFrame.functionName || "(anonymous)";
    self.set(fn, (self.get(fn) ?? 0) + (dt[i] ?? 0));
    total += dt[i] ?? 0;
  });
  console.log(`PROFILE total=${Math.round(total / 1000)}ms`);
  for (const [fn, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 10))
    console.log(
      `  ${Math.round(us / 1000)
        .toString()
        .padStart(6)}ms ${((us / total) * 100).toFixed(0).padStart(3)}%  ${fn}`,
    );
});
