# solid-js 2.0.0-rc.1 repros (branch: `repro/solid-rc1-issues`)

Two findings from migrating this library (a SolidJS port of React Flow /
Svelte Flow) to Solid 2.0 rc.1. Full writeups: `ISSUE-1-companion-walk.md`
and `ISSUE-2-dead-computed.md` in this directory.

This branch is `next` (the 2.0 migration branch) with ONE change: the shipped
workaround for issue 2 is removed in `src/core/projections/layoutedEdges.ts`,
so the bug reproduces on load.

## Setup (once)

```sh
bun install
```

## Issue 1 — flush cost scales with materialized store signals

Standalone script, no browser needed:

```sh
node --conditions=browser repro/companion-walk.mjs
```

Expected output shape (Apple Silicon, rc.1):

```
no readers        (~0 signals/row)   0.28 ms/flush
narrow readers    (~4 signals/row)   0.77 ms/flush
wide+deep readers (~20 signals/row)  1.50 ms/flush
```

Identical workload in every scenario (60 flushes, one leaf of one row each);
only the number of leaves readers have touched differs. The cost is
`updateChildCompanions` walking the store computed's `_child` chain for
`isPending()`/`latest()` companions that don't exist. In the full app
(readers = 3,200 wrapper components) this reached ~60% of flush samples and
~10x drag cost.

To see it live at app scale: `bun run dev`, open
`http://localhost:3000/?example=StressTest&x=40&y=40`, drag a node, profile —
`updateChildCompanions` dominates the flush.

## Issue 2 — first nested projection derive registers ZERO dependencies

Fully automated check (spawns its own dev server + HEADLESS Chrome; the bug
needs real-browser scheduling — jsdom/node pass — but headless Chrome
reproduces it):

```sh
node repro/check-dead-computed.mjs
# on this branch: "rendered edges: 2 of 3 expected ... BUG REPRODUCED" (exit 0)
# on the fixed `next` branch: 3 of 3 (exit 1)
```

Or watch it happen:

```sh
bun run dev
# open http://localhost:3000/?example=StressTest&x=4&y=1
```

**Expected:** 4 nodes, 3 edges. **Actual on this branch:** 2 edges — the
first edge (`0-0 → 1-0`) never renders, on every load, dev or prod build.

Its per-edge projection derived while the node record was committing beneath
its reads and registered no dependencies at all: it never re-runs — node
moves, edge writes, re-measures, nothing wakes it (drag node `0-0` to
confirm: the other edges follow, the missing one never appears).

The one-hunk fix that ships on `next` (see the branch diff): re-assert the
endpoint reads at the END of the derive —

```ts
const row = buildRow(source, edge);
void source.nodeLookup.get(edge.source)?.internals.handleBounds;
void source.nodeLookup.get(edge.target)?.internals.handleBounds;
return { row };
```

— even though `buildRow` performs those same reads earlier in the same
derive. Reads made early in the first nested derive fail to register; reads
made at the end register. Diff against the fix: `git diff next -- src/`.

## For automated analysis

`AGENTS.md` at the repo root of this branch is a self-contained context pack:
verification commands with expected outputs, the relevant source coordinates
in this repo and inside `@solidjs/signals` (searchable internal function
names), the full evidence chain, and what was ruled out.
