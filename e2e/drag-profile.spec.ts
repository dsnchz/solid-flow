import { test } from "./helpers";

/**
 * PROFILE: CDP sampling profile of a node-drag START @10k (mousedown + the
 * first two moves), against the prod preview. Prints the top self-time
 * functions and caller chains of that window. Opt-in:
 *   SOLID_PROD=1 bunx vite build --outDir .benchmarks/prodnames --minify false
 *   bunx vite preview --outDir .benchmarks/prodnames --port 3010
 *   BENCH=1 bunx playwright test e2e/drag-profile.spec.ts
 */
// GESTURE=connection profiles the connection gesture start (mousedown on the
// source handle) instead of a node drag; GESTURE=minimap drags with the
// MiniMap mounted (its first sample partitions the dragged set); GESTURE=reconnect
// profiles 20 programmatic updateEdge(targetHandle) writes instead.
const GESTURE = process.env.GESTURE ?? "drag";

test("PROFILE drag start @10k", async ({ page }) => {
  test.setTimeout(180000);
  // GESTURE=pan: frame-gap recorder for a long pane drag (the stutter probe).
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // attribute mutations on container-level elements (depth <= 4 from the
    // flow root), with timestamps, to correlate with long frames
    const w2 = window as unknown as { __muts: string[]; __longAt: number[] };
    w2.__muts = [];
    w2.__longAt = [];
    let lastT = performance.now();
    const tick2 = (t: number) => {
      if (t - lastT > 25) w2.__longAt.push(Math.round(t));
      lastT = t;
      requestAnimationFrame(tick2);
    };
    requestAnimationFrame(tick2);
    document.addEventListener("DOMContentLoaded", () => {
      new MutationObserver((records) => {
        for (const r of records) {
          const el = r.target as Element;
          let depth = 0;
          let cur: Element | null = el;
          while (cur && cur.getAttribute("role") !== "application" && depth < 6) {
            cur = cur.parentElement;
            depth++;
          }
          if (depth <= 4 && !el.classList.contains("solid-flow__node"))
            w2.__muts.push(
              `${Math.round(performance.now())} ${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join(".")} ${r.attributeName}=${(el.getAttribute(r.attributeName!) ?? "").slice(0, 60)}`,
            );
        }
      }).observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class", "style"],
      });
    });
  });
  await page.goto(
    `/?example=StressTest&x=100&y=100&fit=0${GESTURE === "minimap" ? "&minimap=1" : ""}`,
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".solid-flow__node").length > 9000,
    undefined,
    { timeout: 60000 },
  );
  await page.waitForTimeout(1500);
  const node = page.locator(
    GESTURE === "connection"
      ? '.solid-flow__node[data-id="5-5"] .solid-flow__handle.source'
      : '.solid-flow__node[data-id="5-5"]',
  );
  const box = (await node.boundingBox())!;
  let x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  if (GESTURE === "pan") {
    // a pane spot: the first point below the node grid's first row that hits the pane
    const spot = await page.evaluate(() => {
      for (let yy = 40; yy < 800; yy += 2)
        for (let xx = 20; xx < 1200; xx += 37) {
          const el = document.elementFromPoint(xx, yy);
          if (el?.classList.contains("solid-flow__pane")) return { x: xx, y: yy };
        }
      return null;
    });
    if (!spot) throw new Error("no pane spot found");
    x = spot.x;
    y = spot.y;
  }
  await page.mouse.move(x, y);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");
  if (GESTURE === "reconnect") {
    // Programmatic edge writes (the reconnect bench's loop), no pointer.
    await page.evaluate(() => {
      type Api = {
        flush: () => void;
        api: {
          commands: { updateEdge: (id: string, u: Record<string, unknown>) => void };
          flow: { connections: Record<string, Record<string, unknown>> };
        };
      };
      const { flush, api } = (window as unknown as { __bench: Api }).__bench;
      for (let i = 0; i < 20; i++) {
        api.commands.updateEdge("5-5-6-5", { targetHandle: i % 2 ? "in" : null });
        flush();
        void Object.keys(api.flow.connections["6-5"] ?? {}).length;
      }
    });
  } else if (GESTURE === "pan") {
    await page.mouse.down();
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __muts: string[]; __longAt: number[] };
      w.__frames = [];
      w.__muts = [];
      w.__longAt = [];
      (window as unknown as { __dragStart: number }).__dragStart = Math.round(performance.now());
    });
    for (let i = 0; i < 150; i++) {
      x -= 6;
      y += 2;
      await page.mouse.move(x, y);
      await page.waitForTimeout(16);
    }
  } else {
    await page.mouse.down();
    for (let i = 0; i < 3; i++) {
      x += 4;
      y += 3;
      await page.mouse.move(x, y);
      await page.waitForTimeout(30);
    }
  }
  const { profile } = await cdp.send("Profiler.stop");
  if (GESTURE !== "reconnect") await page.mouse.up();
  if (GESTURE === "pan") {
    const frames = await page.evaluate(
      () => (window as unknown as { __frames: number[] }).__frames,
    );
    const long = frames.filter((f) => f > 25).map((f) => Math.round(f));
    console.log(
      `PAN frames=${frames.length} long(>25ms)=${long.length} [${long.join(", ")}] max=${Math.round(Math.max(...frames))}`,
    );
    const { muts, longAt, dragStart } = await page.evaluate(() => {
      const w = window as unknown as { __muts: string[]; __longAt: number[]; __dragStart: number };
      const nonViewport = w.__muts.filter((m) => !m.includes("xyflow__viewport"));
      const near = w.__muts.filter((m) =>
        w.__longAt.some((t) => Math.abs(Number(m.split(" ")[0]) - t) < 120),
      );
      return {
        muts: [...new Set([...nonViewport, ...near])].slice(0, 40),
        longAt: w.__longAt,
        dragStart: w.__dragStart,
      };
    });
    console.log(`PAN drag started at ${dragStart}; long frames ended at: ${longAt.join(", ")}`);
    for (const m of muts) console.log(`MUT ${m}`);
  }

  const dt = profile.timeDeltas ?? [];
  const samples = profile.samples ?? [];
  const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
  const selfById = new Map<number, number>();
  for (let i = 0; i < samples.length; i++)
    selfById.set(samples[i]!, (selfById.get(samples[i]!) ?? 0) + (dt[i] ?? 0));
  const byLabel = new Map<string, number>();
  for (const [id, us] of selfById) {
    const cf = nodeById.get(id)!.callFrame;
    const url = cf.url.replace(/^https?:\/\/[^/]+/, "") || "(native/program)";
    const label = `${cf.functionName || "(anonymous)"} ${url}:${cf.lineNumber + 1}`;
    byLabel.set(label, (byLabel.get(label) ?? 0) + us / 1000);
  }
  const top = (m: Map<string, number>, k: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
  const total = dt.reduce((a, b) => a + b, 0) / 1000;
  console.log(`${GESTURE.toUpperCase()}-START sampled ${total.toFixed(1)} ms`);
  for (const [l, ms] of top(byLabel, 22)) console.log(`FN  ${ms.toFixed(2).padStart(8)}ms  ${l}`);
  const parentOf = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parentOf.set(c, n.id);
  const chainOf = (id: number, depth = 8) => {
    const names: string[] = [];
    let cur: number | undefined = id;
    while (cur !== undefined && names.length < depth) {
      const cf = nodeById.get(cur)?.callFrame;
      if (cf?.functionName && cf.functionName !== "(anonymous)")
        names.push(
          /^(get|set|outer|effect|computed|has)$/.test(cf.functionName)
            ? `${cf.functionName}@${cf.lineNumber + 1}`
            : cf.functionName,
        );
      cur = parentOf.get(cur);
    }
    return names.reverse().join(" > ");
  };
  const byChain = new Map<string, number>();
  for (const [id, us] of selfById) {
    const ch = chainOf(id);
    byChain.set(ch, (byChain.get(ch) ?? 0) + us / 1000);
  }
  for (const [c, ms] of top(byChain, 24)) console.log(`CHAIN ${ms.toFixed(2).padStart(8)}ms  ${c}`);
});
