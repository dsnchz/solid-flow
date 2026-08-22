# solid-js 2.0.0-rc.1: flush cost scales with materialized store signals (async-companion walk)

**Status:** worked around in @dschz/solid-flow (bb50f3f) by decomposing record
projections into per-row sub-stores; still worth an upstream fix — the cost
hits any sync-only app with one large store and many readers.

## Summary

After **every** update of a store-producing computed, `clearStatus()` calls
`GlobalQueue._updateChildCompanions(el)`, which walks the computed's entire
`_child` linked list checking `child._pendingSignal || child._latestValueComputed`
(the `isPending()` / `latest()` verdict companions).

Every store signal node is created with `firewall = <the store's computed>`
and prepended to `firewall._child` (`signal(v, options, firewall)` in
@solidjs/signals). One node materializes per `(object, key)` that any reader
ever touched in a tracked scope — so a large record store accumulates a child
per leaf any subscriber ever read.

In an app that never calls `isPending()`/`latest()`, **no companions exist**:
every check in the walk is false, and the walk is pure overhead —
O(materialized signals) per store update, per flush. The hook is installed
unconditionally at module load (`GlobalQueue._updateChildCompanions =
updateChildCompanions`), so the `!== null` guard never helps a bundled app.

## Where we hit it

A flow-graph library (@dschz/solid-flow): 1,600 nodes / 1,599 edges as keyed
record projections, each row read by its own wrapper component (~10^5
materialized leaf signals across the two records). Dragging ONE node — one
memo re-run, 5 DOM writes — cost **17.6 ms per mousemove** (prod build,
visible tab). The JS Self-Profiling API attributed **~60% of flush samples to
`updateChildCompanions` at every scale we measured**; run counters proved our
derives did O(changed) work (1 node memo + 2 edge memos per move).

Decomposing into per-row sub-store projections (leaf signals hang off ~30-child
per-row computeds instead of one monolithic record computed) dropped the same
drag to **1.37 ms/move** — confirming the walk was the cost.

## Minimal repro

`companion-walk.mjs` (this directory) — standalone, only needs
`solid-js@2.0.0-rc.1`. From this repo: `node --conditions=browser repro/companion-walk.mjs`.

One keyed record projection, 1,600 rows, per-row memos so the derive is
O(changed). Identical workload in every scenario — 60 flushes, each writing
one leaf of one source row. Only the number of leaves readers touch differs:

| scenario                        | ms/flush (prod) | ms/flush (dev) |
| ------------------------------- | --------------- | -------------- |
| no readers (~0 signals/row)     | 0.28            | 0.36           |
| narrow readers (~4 signals/row) | 0.77            | 0.64           |
| wide+deep readers (~20/row)     | 1.50            | 1.60           |

5.4x for the same data change; grows with component-scale reader counts (the
real app reached ~10x). Nested reads amplify it — each intermediate object
materializes its own node.

## Suggested fix

Track a companion count (or has-companions flag) on the firewall, maintained
at companion creation/disposal; skip the walk when zero. Sync-only apps then
pay nothing, and async apps walk only when companions actually exist below.
