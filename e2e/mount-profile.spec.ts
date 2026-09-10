import { expect, test } from "./helpers";

/**
 * PROFILE: CDP sampling profile of the 10k mount (navigation -> every row
 * measured), against the prod preview. Prints phase timestamps and the top
 * self-time functions / files. Opt-in: BENCH=1 bunx playwright test
 * e2e/mount-profile.spec.ts (preview .benchmarks/dist on :3010 first).
 */
test("PROFILE mount @10k", async ({ page }) => {
  test.setTimeout(180000);
  const codes = new Map<string, number>();
  page.on("console", (m) => {
    if (m.type() !== "warning" && m.type() !== "error") return;
    const code = m.text().match(/\[([A-Z_]+)\]/)?.[1] ?? m.type();
    codes.set(code, (codes.get(code) ?? 0) + 1);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 250 });
  await cdp.send("Profiler.start");
  const t0 = Date.now();
  await page.goto(`/?example=StressTest&x=100&y=100&fit=0`);
  const tNav = Date.now();
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll(".solid-flow__node").length), {
      timeout: 60000,
    })
    .toBeGreaterThan(9000);
  const tNodes = Date.now();
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as unknown as { __bench?: { api: { flow: { nodesInitialized: boolean } } } })
              .__bench?.api.flow.nodesInitialized ?? false,
        ),
      { timeout: 90000, intervals: [100] },
    )
    .toBe(true);
  const tInit = Date.now();
  const { profile } = await cdp.send("Profiler.stop");

  // Aggregate self time per node (functionName@url:line) and per url.
  const byNode = new Map<number, { self: number; label: string; url: string }>();
  const dt = profile.timeDeltas ?? [];
  const samples = profile.samples ?? [];
  const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
  const selfById = new Map<number, number>();
  for (let i = 0; i < samples.length; i++) {
    selfById.set(samples[i]!, (selfById.get(samples[i]!) ?? 0) + (dt[i] ?? 0));
  }
  const total = dt.reduce((a, b) => a + b, 0) / 1000;
  const byLabel = new Map<string, number>();
  const byUrl = new Map<string, number>();
  for (const [id, us] of selfById) {
    const n = nodeById.get(id)!;
    const cf = n.callFrame;
    const url = cf.url.replace(/^https?:\/\/[^/]+/, "") || "(native/program)";
    const label = `${cf.functionName || "(anonymous)"} ${url}:${cf.lineNumber + 1}`;
    byLabel.set(label, (byLabel.get(label) ?? 0) + us / 1000);
    byUrl.set(url, (byUrl.get(url) ?? 0) + us / 1000);
    byNode.set(id, { self: us, label, url });
  }
  const top = (m: Map<string, number>, k: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
  console.log("CONSOLE", JSON.stringify([...codes]));
  console.log(
    `PHASES ms: nav=${tNav - t0} firstRows=${tNodes - tNav} measured=${tInit - tNodes} total=${tInit - t0} sampled=${Math.round(total)}`,
  );
  for (const [u, ms] of top(byUrl, 8))
    console.log(`URL ${Math.round(ms).toString().padStart(6)}ms  ${u}`);
  for (const [l, ms] of top(byLabel, 24))
    console.log(`FN  ${Math.round(ms).toString().padStart(6)}ms  ${l}`);

  // Caller chains: self time attributed to the chain of the last 7 named
  // frames (who is calling the hot engine functions).
  const parentOf = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parentOf.set(c, n.id);
  const chainOf = (id: number, depth = 7) => {
    const names: string[] = [];
    let cur: number | undefined = id;
    while (cur !== undefined && names.length < depth) {
      const cf = nodeById.get(cur)?.callFrame;
      // Generic names carry their line so the bundle can be inspected.
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
  for (const [c, ms] of top(byChain, 24))
    console.log(`CHAIN ${Math.round(ms).toString().padStart(6)}ms  ${c}`);
  // Deep chains for the resolveSource path: which component/binding reads a
  // memo-backed merge source.
  const deep = new Map<string, number>();
  for (const [id, us] of selfById) {
    const cf = nodeById.get(id)!.callFrame.functionName;
    if (cf !== "markHeap" && cf !== "resolveSource" && cf !== "markNode") continue;
    const ch = chainOf(id, 16);
    deep.set(ch, (deep.get(ch) ?? 0) + us / 1000);
  }
  for (const [c, ms] of top(deep, 8))
    console.log(`DEEP ${Math.round(ms).toString().padStart(6)}ms  ${c}`);

  // Phase attribution: walk samples in time order, bucket by wall-clock phase.
  const phaseEnds = [tNav - t0, tNodes - t0, tInit - t0].map((ms) => ms * 1000);
  const phaseTop: Map<string, number>[] = [new Map(), new Map(), new Map()];
  let clock = 0;
  for (let i = 0; i < samples.length; i++) {
    clock += dt[i] ?? 0;
    const phase = clock < phaseEnds[0]! ? 0 : clock < phaseEnds[1]! ? 1 : 2;
    const n = nodeById.get(samples[i]!)!;
    const label = n.callFrame.functionName || "(anonymous)";
    phaseTop[phase]!.set(label, (phaseTop[phase]!.get(label) ?? 0) + (dt[i] ?? 0) / 1000);
  }
  for (const [i, name] of ["nav", "firstRows", "measured"].entries()) {
    for (const [l, ms] of top(phaseTop[i]!, 6))
      console.log(`PHASE-${name} ${Math.round(ms).toString().padStart(6)}ms  ${l}`);
  }
});
