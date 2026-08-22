# Agent context — branch `repro/solid-rc1-issues`

This branch exists to reproduce two solid-js `2.0.0-rc.1` framework issues,
filed as:

- https://github.com/solidjs/solid/issues/3037 — first nested projection
  derive can register ZERO dependencies (permanently dead computed).
  Correctness, browser-only, silent.
- https://github.com/solidjs/solid/issues/3038 — flush cost scales with total
  materialized store signals (async-companion walk). Performance, all
  environments.

It is the library's 2.0 migration branch (`next`) plus exactly one change:
the shipped workaround for #3037 is removed so the bug manifests. The full
fix is visible as `git diff next -- src/` (one hunk in
`src/core/projections/layoutedEdges.ts`).

## Verify both issues without a human

```sh
bun install

# Issue #3038 (perf) — pure node, prints a cost table:
node --conditions=browser repro/companion-walk.mjs
# expected shape: ~0.28 ms/flush with no readers -> ~1.5-1.9 ms/flush with
# wide readers, for an IDENTICAL single-leaf-write workload.

# Issue #3037 (dead computed) — spawns its own dev server + headless Chrome:
node repro/check-dead-computed.mjs
# expected on THIS branch: "rendered edges: 2 of 3 expected ... BUG REPRODUCED",
# exit 0. On the fixed `next` branch the same command prints 3/3 and exits 1.
# The bug does NOT reproduce in jsdom or node-only harnesses — the same
# wiring passes as a headless vitest test (this negative result is part of
# the report); a real Chromium is required, headless is fine.
```

## Where the relevant code is

In this repo:

- `src/core/projections/internalNodes.ts` — per-node-row keyed projections
  (created in an id-keyed `mapArray`) + a SHALLOW draft-form record
  projection holding the row proxies by reference.
- `src/core/projections/layoutedEdges.ts` — per-edge keyed projections whose
  derives read node rows through the record via a Map facade
  (`src/core/facades.ts`). THIS is where the #3037 workaround was removed:
  on `next`, the derive ends with two re-assert reads
  (`void source.nodeLookup.get(edge.source)?.internals.handleBounds;` etc.)
  that deterministically fix the dead computed, even though `buildRow`
  performs the same reads earlier in the same derive.
- `repro/ISSUE-1-companion-walk.md`, `repro/ISSUE-2-dead-computed.md` — full
  writeups including the evidence chain and everything ruled out.

In `@solidjs/signals` 2.0.0-rc.1 (`node_modules/@solidjs/signals/dist/dev.js`
after install — function names are searchable in the dev build):

- `updateChildCompanions(el)` — the walk at the center of #3038: iterates
  `el._child` checking `child._pendingSignal || child._latestValueComputed`.
- `clearStatus(el)` — calls it after every computation update.
- `signal(v, options, firewall)` — attaches every store signal node to
  `firewall._child`; the firewall is the owning store's computed, which is
  why one large record store accumulates a child per leaf ever read.
- `GlobalQueue._updateChildCompanions = updateChildCompanions` — hook
  installed unconditionally at module load.
- For #3037, the relevant machinery is the projection derive/commit path
  (`createProjectionInternal`, `runProjectionComputed`, the write-trap
  draft) and eager computed construction (`computed()` recomputes at
  creation unless lazy) — the dead computed's first derive runs nested
  inside another projection's derive while that store's first commit is in
  flight.

## Key facts an analysis should preserve

- #3037 evidence: deterministic, dev AND prod solid builds; run counters
  showed the dead derive ran during mount then never again while its sources
  kept notifying other subscribers; no write to any of its sources wakes it;
  reads made at the END of the first nested derive register, identical reads
  made EARLIER in the same derive do not. Ruled out one at a time:
  structural-read-on-bail, memo indirection around store creation, flush()
  vs microtask auto-flush, keyed vs reference-keyed mapArray.
- #3038 evidence: JS Self-Profiling in Chrome attributed ~60% of flush
  samples to `updateChildCompanions` at 625 and 1600 nodes; app-level fix
  (per-row sub-stores so leaves hang off ~30-child computeds) took a 1-node
  drag from 17.6 ms to 1.37 ms with identical DOM output (5 mutations/move).
- Separate known sharp edge, NOT these bugs: reads of absent record keys
  inside projection derives do not subscribe (even with an `in` guard);
  structural reads (`Object.keys`, `.size` over keys) do.
