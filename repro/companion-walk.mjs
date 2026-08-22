// Repro: flush cost scales with the number of MATERIALIZED store signals,
// not with what changed.
//
// After every update of a store-producing computed, clearStatus() calls
// GlobalQueue._updateChildCompanions, which walks the computed's entire
// `_child` chain — one node per (object, key) any reader ever touched —
// checking for isPending()/latest() companions. In sync-only code none
// exist, so every check is false and the walk is pure overhead, paid on
// every flush that updates the store computed.
//
// Structure below keeps the derive itself O(changed) (per-row memos feeding
// a keyed record projection), so the only thing that differs between the
// scenarios is how many leaf signals readers have materialized. The workload
// is identical: 60 flushes, each writing one leaf of one source row.
//
//   npm i solid-js@2.0.0-rc.1
//   node --conditions=browser repro-companion-walk.mjs
import {
  createEffect,
  createMemo,
  createProjection,
  createRoot,
  createStore,
  flush,
  mapArray,
} from "solid-js";

const N = 1600;

const makeRows = () =>
  Array.from({ length: N }, (_, i) => ({
    id: `r${i}`,
    position: { x: i, y: 0 },
    size: { width: 100, height: 40 },
    meta: { kind: "row", flags: { a: true, b: false, c: true } },
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
    f: 6,
    g: 7,
    h: 8,
    i: 9,
    j: 10,
  }));

const run = (label, leafReadsPerRow) => {
  createRoot((dispose) => {
    const [rows, setRows] = createStore(makeRows());
    // per-row memos: a single-row write re-runs exactly one memo
    const rowMemos = mapArray(
      () => rows,
      (r) => createMemo(() => ({ ...r, derived: r.position.x * 2 })),
    );
    const proj = createProjection(
      () => {
        const out = {};
        for (const memo of rowMemos()) {
          const row = memo();
          out[row.id] = row;
        }
        return out;
      },
      {},
      { key: "id" },
    );
    flush();

    // materialize leaf signals: one subscriber per row; "wide" also reads
    // nested paths (each intermediate object materializes its own node)
    if (leafReadsPerRow > 0) {
      const keys = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
      for (let i = 0; i < N; i++) {
        const id = `r${i}`;
        createEffect(
          () => {
            const row = proj[id];
            if (!row) return 0;
            let sum = row.derived + row.position.x + row.position.y;
            if (leafReadsPerRow > 2) {
              sum += row.size.width + row.size.height;
              sum += row.meta.flags.a ? 1 : 0;
              sum += row.meta.flags.c ? 1 : 0;
            }
            for (let k = 0; k < leafReadsPerRow; k++) sum += row[keys[k % keys.length]];
            return sum;
          },
          () => {},
        );
      }
      flush();
    }

    // identical workload for every scenario: 60 single-leaf writes
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      setRows((draft) => {
        draft[800].position = { x: 100000 + i, y: 0 };
        return undefined;
      });
      flush();
    }
    const perFlush = (performance.now() - t0) / 60;
    console.log(`${label.padEnd(36)} ${perFlush.toFixed(3)} ms/flush`);
    dispose();
  });
};

run("no readers        (~0 signals/row)", 0);
run("narrow readers    (~4 signals/row)", 1);
run("wide+deep readers (~20 signals/row)", 10);
console.log(
  "\nIdentical single-leaf-write workload and identical derive work (one memo",
  "\nre-runs per flush); only the count of materialized leaf signals differs.",
  "\nChrome profile of this shape in a real app: ~60% of flush samples inside",
  "\nupdateChildCompanions (clearStatus -> GlobalQueue._updateChildCompanions),",
  "\nevery `child._pendingSignal || child._latestValueComputed` check false —",
  "\nisPending()/latest() are never used.",
);
