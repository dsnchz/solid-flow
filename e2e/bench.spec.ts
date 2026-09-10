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

test("BENCH minimap rAF sampling @10k", async ({ page }) => {
  test.setTimeout(120000);
  await waitForStress(page, "&minimap=1");

  // The listener wrapper cannot see rAF work; time every requestAnimationFrame
  // callback registered after instrumentation instead (the minimap's drag
  // sampling tick registers at drag start).
  await page.evaluate(() => {
    const w = window as unknown as { __raf: number[] };
    w.__raf = [];
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      original((t) => {
        const t0 = performance.now();
        cb(t);
        w.__raf.push(performance.now() - t0);
      });
  });

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
  const raf = await page.evaluate(() => {
    const s = [...(window as unknown as { __raf: number[] }).__raf].sort((a, b) => a - b);
    const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
    return {
      n: s.length,
      mean: Math.round(mean * 100) / 100,
      p95: Math.round((s[Math.floor(s.length * 0.95)] ?? 0) * 100) / 100,
      worst: Math.round((s[s.length - 1] ?? 0) * 100) / 100,
    };
  });
  console.log("MINIMAP rAF @10k:", JSON.stringify(raf));
  expect(raf.n).toBeGreaterThan(0);
});

test("BENCH mount @10k", async ({ page }) => {
  test.setTimeout(120000);
  // Navigation start -> all rows measured (flow.nodesInitialized), prod build.
  await page.goto(`/?example=StressTest&x=100&y=100&fit=0`);
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const w = window as unknown as {
          __bench?: { api: { flow: { nodesInitialized: boolean } } };
        };
        const tick = () => {
          if (w.__bench?.api.flow.nodesInitialized) resolve(performance.now());
          else requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  console.log("MOUNT @10k (ms to nodesInitialized):", Math.round(ms));
  expect(ms).toBeGreaterThan(0);
});

test("BENCH node resize @10k", async ({ page }) => {
  test.setTimeout(120000);
  // The measurement ingest runs in requestIdleCallback, which the library
  // binds at module load — wrap it BEFORE any page script runs so the idle
  // callbacks (the measurement-write cadence) are timed too.
  await page.addInitScript(() => {
    const w = window as unknown as { __idle: number[]; __idleScheduled: number };
    w.__idle = [];
    w.__idleScheduled = 0;
    const original = window.requestIdleCallback.bind(window);
    window.requestIdleCallback = (cb: IdleRequestCallback, opts?: IdleRequestOptions) =>
      original((deadline) => {
        w.__idleScheduled++;
        const t0 = performance.now();
        cb(deadline);
        w.__idle.push(performance.now() - t0);
      }, opts);
  });
  await waitForStress(page, "&resizer=1");
  await page.evaluate(instrument);
  // Reset: mount's own idle passes are not the resize cost.
  await page.evaluate(() => {
    (window as unknown as { __idle: number[] }).__idle = [];
  });

  // XYResizer attaches its d3-drag listeners at gesture start, so the wrapper
  // times each resize frame; the DOM re-measure lands as a measurement write
  // in the idle callback — the cadence nodesInitialized used to re-derive on.
  const handle = page.locator(
    '.solid-flow__node[data-id="5-5"] .solid-flow__resize-control.handle.bottom.right',
  );
  await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  let x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    x += 2;
    y += 1;
    await page.mouse.move(x, y);
    await page.waitForTimeout(5);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log("RESIZE listener @10k:", JSON.stringify(await page.evaluate(stats)));
  console.log(
    "RESIZE idle callbacks fired:",
    await page.evaluate(() => (window as unknown as { __idleScheduled: number }).__idleScheduled),
  );
  console.log(
    // The NodeResizer path writes dimensions synchronously (XYResizer →
    // applyNodeChanges), so no idle ingest runs during the gesture — this
    // stays 0 by design; the idle path is the DOM-measure (ResizeObserver)
    // cadence, exercised by mount (bench round 25 resolved the "gap").
    "RESIZE idle-ingest @10k (0 expected):",
    JSON.stringify(
      await page.evaluate(() => {
        const s = [...(window as unknown as { __idle: number[] }).__idle].sort((a, b) => a - b);
        const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
        return {
          n: s.length,
          mean: Math.round(mean * 100) / 100,
          p95: Math.round((s[Math.floor(s.length * 0.95)] ?? 0) * 100) / 100,
          worst: Math.round((s[s.length - 1] ?? 0) * 100) / 100,
        };
      }),
    ),
  );
});

test("BENCH reconnect + marker writes @10k", async ({ page }) => {
  test.setTimeout(120000);
  await waitForStress(page);
  // In-page timing of programmatic edge writes: the connections index and the
  // marker definitions re-derive on these — the round-16 fan-in targets.
  // Each sample = write + flush + a read that pulls the derived record.
  const result = await page.evaluate(() => {
    type Api = {
      flush: () => void;
      api: {
        commands: { updateEdge: (id: string, u: Record<string, unknown>) => void };
        flow: { connections: Record<string, Record<string, unknown>> };
      };
    };
    const { flush, api } = (window as unknown as { __bench: Api }).__bench;
    const edgeId = "5-5-6-5";
    const summarize = (s: number[]) => {
      s.sort((a, b) => a - b);
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      return {
        mean: Math.round(mean * 100) / 100,
        p95: Math.round(s[Math.floor(s.length * 0.95)]! * 100) / 100,
        worst: Math.round(s[s.length - 1]! * 100) / 100,
      };
    };
    const reconnect: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      api.commands.updateEdge(edgeId, { targetHandle: i % 2 ? "in" : null });
      flush();
      void Object.keys(api.flow.connections["6-5"] ?? {}).length;
      reconnect.push(performance.now() - t0);
    }
    const marker: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      api.commands.updateEdge(edgeId, { markerEnd: i % 2 ? { type: "arrow" } : undefined });
      flush();
      void document.querySelectorAll(".solid-flow__marker marker").length;
      marker.push(performance.now() - t0);
    }
    return { reconnect: summarize(reconnect), marker: summarize(marker) };
  });
  console.log("RECONNECT @10k:", JSON.stringify(result.reconnect));
  console.log("MARKER @10k:", JSON.stringify(result.marker));
  expect(result.reconnect.mean).toBeGreaterThan(0);
});

test("BENCH memory @10k", async ({ page }) => {
  test.setTimeout(300000);
  // JS heap + DOM/listener counts after a forced GC: after mount, after
  // deleting every element (what the flow retains), and after re-adding them.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.enable");
  const sample = async (label: string) => {
    await page.waitForTimeout(300);
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    const row = {
      heapMB: Math.round((m.JSHeapUsedSize! / 1048576) * 10) / 10,
      domNodes: m.Nodes,
      listeners: m.JSEventListeners,
    };
    console.log(`MEMORY ${label}:`, JSON.stringify(row));
    return row;
  };
  // MEM_PARAMS adds stress-page params, e.g. "&uncontrolled=1" (the flow copies
  // and owns the rows). The controlled default keeps the raw nodeItems array
  // alive in the example, which pins the engine's per-object store targets
  // (WeakMap-keyed on the raw rows) — expected there, not a leak.
  const extra = process.env.MEM_PARAMS ?? "";
  await page.goto("about:blank");
  const blank = await sample("blank page");
  await waitForStress(page, extra);
  const mounted = await sample(`mounted @10k${extra}`);
  await page.evaluate(async () => {
    const { api, flush } = (
      window as unknown as {
        __bench: {
          api: {
            flow: { nodes: unknown[]; edges: unknown[] };
            commands: {
              toObject: () => { nodes: unknown[]; edges: unknown[] };
              deleteElements: (p: { nodes: unknown[]; edges: unknown[] }) => Promise<unknown>;
            };
          };
          flush: () => void;
        };
      }
    ).__bench;
    // Plain clones for the re-add — never the row proxies (keeping those alive
    // would pin every store target and fake a leak).
    (window as unknown as { __saved: unknown }).__saved = api.commands.toObject();
    await api.commands.deleteElements({ nodes: [...api.flow.nodes], edges: [...api.flow.edges] });
    flush();
  });
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll(".solid-flow__node").length))
    .toBe(0);
  const emptied = await sample("after deleting all");
  await page.evaluate(() => {
    const { api, flush } = (
      window as unknown as {
        __bench: {
          api: { commands: { addNodes: (n: unknown) => void; addEdges: (e: unknown) => void } };
          flush: () => void;
        };
      }
    ).__bench;
    const saved = (window as unknown as { __saved: { nodes: unknown[]; edges: unknown[] } })
      .__saved;
    api.commands.addNodes(saved.nodes);
    api.commands.addEdges(saved.edges);
    flush();
  });
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll(".solid-flow__node").length), {
      timeout: 60000,
    })
    .toBeGreaterThan(9000);
  const remounted = await sample("after re-adding all");
  console.log(
    `MEMORY summary: mount +${(mounted.heapMB - blank.heapMB).toFixed(1)} MB; retained after delete ${(emptied.heapMB - blank.heapMB).toFixed(1)} MB; remount ${remounted.heapMB.toFixed(1)} MB`,
  );
  expect(mounted.heapMB).toBeGreaterThan(blank.heapMB);
});

test("BENCH memory unmount @10k", async ({ page }) => {
  test.setTimeout(300000);
  // What a full SolidFlow unmount releases, against the delete-all number of
  // the scenario above: if the unmount lands near the blank page while
  // delete-all retains, the retention lives in the live flow's projections.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.enable");
  const sample = async (label: string) => {
    await page.waitForTimeout(300);
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    const heapMB = Math.round((m.JSHeapUsedSize! / 1048576) * 10) / 10;
    console.log(`MEMORY ${label}:`, JSON.stringify({ heapMB, domNodes: m.Nodes }));
    return heapMB;
  };
  type W = { __bench: { setMounted: (v: boolean) => void; flush: () => void } };
  const extra = process.env.MEM_PARAMS ?? "";
  await page.goto("about:blank");
  const blank = await sample("blank page");
  await waitForStress(page, extra);
  const mounted = await sample(`mounted @10k${extra}`);
  await page.evaluate(() => {
    const { setMounted, flush } = (window as unknown as W).__bench;
    setMounted(false);
    flush();
  });
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll(".solid-flow").length))
    .toBe(0);
  const unmounted = await sample("after unmounting SolidFlow");
  await page.evaluate(() => {
    const { setMounted, flush } = (window as unknown as W).__bench;
    setMounted(true);
    flush();
  });
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll(".solid-flow__node").length), {
      timeout: 60000,
    })
    .toBeGreaterThan(9000);
  const remounted = await sample("after remounting");
  console.log(
    `MEMORY unmount summary: mount +${(mounted - blank).toFixed(1)} MB; retained after unmount ${(unmounted - blank).toFixed(1)} MB; remount ${remounted.toFixed(1)} MB`,
  );
  expect(unmounted).toBeLessThan(mounted);
});

test("BENCH getIntersectingNodes @10k", async ({ page }) => {
  test.setTimeout(120000);
  await waitForStress(page);
  // One call per task: each pays the microtask-cached grid build (bench
  // round 25: built from the geometry map instead of 10k proxy reads).
  const result = await page.evaluate(async () => {
    type Api = {
      api: { commands: { getIntersectingNodes: (rect: unknown) => unknown[] } };
    };
    const { api } = (window as unknown as { __bench: Api }).__bench;
    const samples: number[] = [];
    let found = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
      const t0 = performance.now();
      found = api.commands.getIntersectingNodes({
        x: 1000 + i,
        y: 1000,
        width: 400,
        height: 300,
      }).length;
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return {
      mean: Math.round(mean * 100) / 100,
      worst: Math.round(samples[19]! * 100) / 100,
      found,
    };
  });
  console.log("INTERSECT @10k:", JSON.stringify(result));
  expect(result.found).toBeGreaterThan(0);
});
