import { expect, test } from "./helpers";

/**
 * Heap attribution after delete-all (bench round 19 follow-up). Takes a V8
 * heap snapshot via CDP at three points and aggregates SELF size by node
 * type+name (constructor for objects, function name for closures). Run
 * against an UNMINIFIED dev-condition build so engine class names survive:
 *   bunx vite build --outDir .bench-names --minify false
 *   bunx vite preview --outDir .bench-names --port 3010
 *   BENCH=1 bunx playwright test e2e/heap-snapshot.spec.ts
 */
type Agg = Map<string, { size: number; count: number }>;

const snapshot = async (cdp: import("@playwright/test").CDPSession): Promise<Agg> => {
  const chunks: string[] = [];
  const onChunk = (e: { chunk: string }) => chunks.push(e.chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  const snap = JSON.parse(chunks.join("")) as {
    snapshot: { meta: { node_fields: string[]; node_types: (string[] | string)[] } };
    nodes: number[];
    strings: string[];
  };
  const fields = snap.snapshot.meta.node_fields;
  const stride = fields.length;
  const iType = fields.indexOf("type");
  const iName = fields.indexOf("name");
  const iSize = fields.indexOf("self_size");
  const typeNames = snap.snapshot.meta.node_types[iType] as string[];
  const edgeFields = (
    snap.snapshot.meta as unknown as { edge_fields: string[]; edge_types: (string[] | string)[] }
  ).edge_fields;
  const edgeTypes = (snap.snapshot.meta as unknown as { edge_types: (string[] | string)[] })
    .edge_types[0] as string[];
  const edges = (snap as unknown as { edges: number[] }).edges;
  const eStride = edgeFields.length;
  const iEdgeCount = fields.indexOf("edge_count");
  const nodeCount = snap.nodes.length / stride;
  // reverse index: for each node index, list of [fromNodeIndex, edgeType, edgeName]
  const incoming = new Map<number, [number, string, string][]>();
  {
    let e = 0;
    for (let n = 0; n < nodeCount; n++) {
      const count = snap.nodes[n * stride + iEdgeCount]!;
      for (let k = 0; k < count; k++, e += eStride) {
        const et = edgeTypes[edges[e]!]!;
        const nameOrIndex = edges[e + 1]!;
        const to = edges[e + 2]! / stride;
        const ename =
          et === "element" || et === "hidden" ? `[${nameOrIndex}]` : snap.strings[nameOrIndex]!;
        (incoming.get(to) ?? incoming.set(to, []).get(to)!).push([n, et, ename]);
      }
    }
  }
  const nodeName = (n: number) =>
    `${typeNames[snap.nodes[n * stride + iType]!]}:${snap.strings[snap.nodes[n * stride + iName]!]!.slice(0, 40)}`;
  // Outgoing property lookup: `_name` (engine node names) for labels.
  const outgoingName = (n: number, prop: string): string | undefined => {
    const count = snap.nodes[n * stride + iEdgeCount]!;
    let e = 0;
    for (let k = 0; k < n; k++) e += snap.nodes[k * stride + iEdgeCount]! * eStride;
    for (let k = 0; k < count; k++, e += eStride) {
      const et = edgeTypes[edges[e]!]!;
      if (et !== "property") continue;
      if (snap.strings[edges[e + 1]!] !== prop) continue;
      const to = edges[e + 2]! / stride;
      return snap.strings[snap.nodes[to * stride + iName]!];
    }
    return undefined;
  };
  // Retaining paths from the GC root: BFS over non-weak edges (parent
  // pointers), then for each retained store target read the path back to the
  // root and keep the nearest NAMED frames (engine `_name`, closure name,
  // Window/Document, Map/WeakMap tables) — the actual holders.
  const parent = new Int32Array(nodeCount).fill(-1);
  const parentEdge = new Array<string>(nodeCount);
  {
    // forward adjacency built once
    const firstEdge = new Int32Array(nodeCount);
    let e = 0;
    for (let n = 0; n < nodeCount; n++) {
      firstEdge[n] = e;
      e += snap.nodes[n * stride + iEdgeCount]! * eStride;
    }
    const queue = new Int32Array(nodeCount);
    let head = 0;
    let tail = 0;
    queue[tail++] = 0;
    parent[0] = 0;
    while (head < tail) {
      const n = queue[head++]!;
      const count = snap.nodes[n * stride + iEdgeCount]!;
      let ee = firstEdge[n]!;
      for (let k = 0; k < count; k++, ee += eStride) {
        const et = edgeTypes[edges[ee]!]!;
        if (et === "weak" || et === "shortcut") continue;
        // Ephemerons: do not traverse OUT of weak collections (a WeakMap value
        // is retained only through its key, which the BFS cannot tell apart).
        if (/^object:(WeakMap|WeakSet|WeakRef)/.test(nodeName(n))) continue;
        const to = edges[ee + 2]! / stride;
        if (parent[to] !== -1) continue;
        parent[to] = n;
        const ni = edges[ee + 1]!;
        parentEdge[to] =
          et === "element" || et === "hidden" || et === "internal"
            ? `${et}[${ni}]`
            : `${et}:${snap.strings[ni]!.slice(0, 30)}`;
        queue[tail++] = to;
      }
    }
  }
  const named = (n: number): string | undefined => {
    const nm = nodeName(n);
    if (nm.startsWith("closure:") && nm.length > 8) return nm;
    if (/^(object:Window|object:HTMLDocument|native:|object:system)/.test(nm)) return nm;
    const en = outgoingName(n, "_name");
    if (en) return `${nm}[_name=${en}]`;
    // unnamed engine nodes: label by their compute function, if any
    if (nm === "object:Object") {
      const fn = outgoingName(n, "_fn");
      if (fn !== undefined) return `engine[_fn=${fn || "anonymous"}]`;
    }
    if (
      !/^(object:Object|array:|object:Array|hidden:|object:TargetShape|native:system \/ JSProxy)/.test(
        nm,
      )
    )
      return nm;
    return undefined;
  };
  const chains: Agg = new Map();
  let sampled = 0;
  for (let n = 0; n < nodeCount && sampled < 3000; n++) {
    if (!nodeName(n).startsWith("object:TargetShape")) continue;
    sampled++;
    const frames: string[] = [];
    let cur = n;
    for (let d = 0; d < 400 && cur !== 0 && parent[cur] !== -1; d++) {
      const p = parent[cur]!;
      const lbl = named(p);
      const frame = lbl ? `${lbl} .${parentEdge[cur]}` : undefined;
      // collapse sibling-list walks (signal._nextChild chains) into one frame
      if (frame && frames[frames.length - 1] !== frame) frames.push(frame);
      cur = p;
    }
    const key =
      parent[n] === -1
        ? "(reachable ONLY through a weak collection — key must be alive elsewhere)"
        : frames.slice(0, 6).join("  <=  ") || "(root)";
    const c = chains.get(key) ?? { size: 0, count: 0 };
    c.count += 1;
    chains.set(key, c);
  }
  (globalThis as unknown as { __lastChains: Agg }).__lastChains = chains;
  const agg: Agg = new Map();
  for (let i = 0; i < snap.nodes.length; i += stride) {
    const type = typeNames[snap.nodes[i + iType]!]!;
    const name = snap.strings[snap.nodes[i + iName]!]!;
    const size = snap.nodes[i + iSize]!;
    const key = `${type}:${type === "string" || type === "concatenated string" || type === "sliced string" ? "(strings)" : name.slice(0, 60)}`;
    const cur = agg.get(key) ?? { size: 0, count: 0 };
    cur.size += size;
    cur.count += 1;
    agg.set(key, cur);
  }
  return agg;
};

const print = (label: string, agg: Agg, top = 22) => {
  let total = 0;
  for (const v of agg.values()) total += v.size;
  console.log(`HEAP ${label}: total self ${(total / 1048576).toFixed(1)} MB, ${agg.size} kinds`);
  for (const [k, v] of [...agg].sort((a, b) => b[1].size - a[1].size).slice(0, top))
    console.log(
      `  ${(v.size / 1048576).toFixed(1).padStart(7)} MB ${String(v.count).padStart(8)}  ${k}`,
    );
};

const diff = (a: Agg, b: Agg): Agg => {
  const out: Agg = new Map();
  for (const [k, v] of b) {
    const base = a.get(k) ?? { size: 0, count: 0 };
    out.set(k, { size: v.size - base.size, count: v.count - base.count });
  }
  return out;
};

test("PROBE heap attribution after delete-all", async ({ page }) => {
  test.setTimeout(600000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  const side = Number(process.env.HEAP_SIDE ?? 20);
  await page.goto(`/?example=StressTest&x=${side}&y=${side}&fit=0${process.env.HEAP_PARAMS ?? ""}`);
  type W = {
    __bench: {
      api: {
        flow: { nodes: unknown[]; edges: unknown[]; nodesInitialized: boolean };
        commands: {
          deleteElements: (p: { nodes: unknown[]; edges: unknown[] }) => Promise<unknown>;
        };
      };
      flush: () => void;
    };
  };
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as W).__bench?.api.flow.nodesInitialized ?? false),
      { timeout: 120000, intervals: [200] },
    )
    .toBe(true);
  await page.waitForTimeout(500);
  const mounted = await snapshot(cdp);
  print(`mounted @${side * side}`, mounted);
  await page.evaluate(async () => {
    const { api, flush } = (window as unknown as W).__bench;
    await api.commands.deleteElements({ nodes: [...api.flow.nodes], edges: [...api.flow.edges] });
    flush();
  });
  await expect
    .poll(async () => page.evaluate(() => document.querySelectorAll(".solid-flow__node").length))
    .toBe(0);
  await page.waitForTimeout(1500); // let deferred release timers run
  const emptied = await snapshot(cdp);
  print(`after delete-all @${side * side} (retained)`, emptied, 14);
  const chains = (globalThis as unknown as { __lastChains: Agg }).__lastChains;
  console.log(
    "RETAINERS of store targets after delete-all (first 4000 sampled; count, holder + owner chain):",
  );
  for (const [k, v] of [...chains].sort((a, b) => b[1].count - a[1].count).slice(0, 12))
    console.log(`  ${String(v.count).padStart(7)}  ${k}`);
  print("delta mounted -> emptied (negative = released)", diff(mounted, emptied), 12);
});
