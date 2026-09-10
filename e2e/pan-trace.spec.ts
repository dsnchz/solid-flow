import { test } from "./helpers";

/**
 * PROBE: Chrome trace of a 2.5s pane drag @10k, bucketed by event kind, and
 * every trace event longer than 20ms (what a long frame was spent on: script,
 * style recalc, layout, paint, GC). BENCH=1 only; prod preview on :3010.
 */
test("PROBE pan trace @10k", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(`/?example=StressTest&x=100&y=100&fit=0`);
  await page.waitForFunction(
    () => document.querySelectorAll(".solid-flow__node").length > 9000,
    undefined,
    { timeout: 60000 },
  );
  await page.waitForTimeout(1500);
  const spot = await page.evaluate(() => {
    for (let yy = 40; yy < 800; yy += 2)
      for (let xx = 20; xx < 1200; xx += 37) {
        const el = document.elementFromPoint(xx, yy);
        if (el?.classList.contains("solid-flow__pane")) return { x: xx, y: yy };
      }
    return null;
  });
  if (!spot) throw new Error("no pane spot");
  let { x, y } = spot;
  const cdp = await page.context().newCDPSession(page);
  type TraceEvent = { name: string; dur?: number; args?: { data?: unknown } };
  const events: TraceEvent[] = [];
  cdp.on("Tracing.dataCollected", (e) => {
    for (const raw of e.value as Record<string, unknown>[]) {
      events.push({
        name: String(raw.name),
        dur: typeof raw.dur === "number" ? raw.dur : undefined,
        args: raw.args as { data?: unknown } | undefined,
      });
    }
  });
  const done = new Promise<void>((r) => cdp.once("Tracing.tracingComplete", () => r()));
  await cdp.send("Tracing.start", {
    categories:
      "devtools.timeline,disabled-by-default-devtools.timeline,v8.execute,blink.user_timing",
    transferMode: "ReportEvents",
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 150; i++) {
    x -= 6;
    y += 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await cdp.send("Tracing.end");
  await done;
  const byName = new Map<string, { ms: number; n: number; max: number }>();
  for (const e of events) {
    if (!e.dur) continue;
    const ms = e.dur / 1000;
    const cur = byName.get(e.name) ?? { ms: 0, n: 0, max: 0 };
    cur.ms += ms;
    cur.n++;
    cur.max = Math.max(cur.max, ms);
    byName.set(e.name, cur);
  }
  const top = [...byName].sort((a, b) => b[1].ms - a[1].ms).slice(0, 14);
  for (const [name, v] of top)
    console.log(
      `TRACE ${v.ms.toFixed(1).padStart(8)}ms total  n=${String(v.n).padStart(5)}  max ${v.max.toFixed(1).padStart(6)}ms  ${name}`,
    );
  const long = events.filter(
    (e) => e.dur && e.dur / 1000 > 8 && e.name !== "RunTask" && e.name !== "EventDispatch",
  );
  for (const e of long.slice(0, 12))
    console.log(
      `LONG ${(e.dur! / 1000).toFixed(1)}ms ${e.name} ${JSON.stringify(e.args?.data ?? {}).slice(0, 120)}`,
    );
});
