# solid-js 2.0.0-rc.1: first nested projection derive can register ZERO dependencies (permanently dead computed)

**Status:** worked around in @dschz/solid-flow (bb50f3f); deterministic in the
app, browser-only, silent. The nastier of the two rc.1 findings — it is
correctness-shaped, not perf-shaped.

## Summary

A projection whose **first derive runs nested while another projection's
store is committing beneath its reads** can end up with **no dependencies at
all**: it never re-runs, for anything, ever. No error, no warning — the
computed just holds its initial value forever.

Setup where it bites (a chain of projections):

1. `internalNodes` — a SHALLOW draft-form record projection whose slots hold
   per-row projection store proxies (rows created in an id-keyed `mapArray`).
2. `layoutedEdges` — per-edge projections whose derives read node rows
   through the record (`record[id].internals.handleBounds` etc.), plus its
   own shallow record.
3. On first pull of the edge record, `mapArray` creates the edge-row
   projections; each one's computed **eagerly derives at construction**,
   nested inside the outer record's derive — while the node record's own
   first commit is still in flight beneath those reads.

Result: the **first** edge-row projection created in that window registered
zero deps. Its endpoints later measured, moved, and re-derived (verified by
run counters — the NODE rows updated fine); edge-prop writes landed; nothing
ever woke the dead computed. The first edge of the graph simply never
rendered.

## Evidence (all deterministic, ~6 reproductions per configuration)

- Reproduces in Chrome with BOTH the dev and prod builds of solid-js, in the
  full app, 100% of loads (a 4-node / 3-edge graph loses its first edge).
- Does NOT reproduce in vitest/jsdom or node with the same wiring — the same
  integration test passes there. Something about real-browser scheduling
  (rAF/idle-callback interleaving of the first flushes) is part of the
  trigger.
- Run counters: the dead edge-row derive ran 3x during mount (all reading
  stale/unready state), then never again — while its dependency sources kept
  updating and notifying live subscribers elsewhere.
- Wake-probes: writes to the edge's own props, node moves, forced
  re-measures — none re-ran it. Zero subscriptions.
- Binary-searched instrumentation: adding an **unconditional re-read** of
  `nodeLookup.get(edge.source)?.internals.handleBounds` at the END of the
  derive fixes it 100% deterministically — even though buildRow performs the
  same reads earlier in the same derive. Reads made EARLIER in the first
  nested derive fail to register; reads made at the end register.
- Ruled out (each tested in isolation, none fixed it): structural
  `Object.keys`-style reads on the bail path; routing row-store creation
  through a memo indirection; `flush()` vs microtask auto-flush; keyed vs
  reference-keyed mapArray (keying by id fixed a DIFFERENT stranding bug —
  disposed-store subscriptions on array resets — but not this one).

## Repro

Minimal standalone attempts (import-map page replicating the exact wiring,
pre-flush pulls, render-effect first pull, mount-time double-array reset,
staged measurement flushes) do NOT reproduce — the negative result is part of
the report. The full app reproduces on every load; the dedicated branch has
the workaround already removed:

```
git clone https://github.com/dsnchz/solid-flow && cd solid-flow
git checkout repro/solid-rc1-issues
bun install && bun run dev
# open http://localhost:3000/?example=StressTest&x=4&y=1
# -> 4 nodes, 2 of 3 edges: the first edge (0-0 -> 1-0) never appears
```

Diff vs the fix: `git diff next -- src/` (one hunk in
src/core/projections/layoutedEdges.ts).

## Workaround (shipped)

Re-assert the presence-deciding cross-store leaves at the END of the derive:

```ts
const row = buildRow(source, edge);
void source.nodeLookup.get(edge.source)?.internals.handleBounds;
void source.nodeLookup.get(edge.target)?.internals.handleBounds;
return { row };
```

plus a structural `nodeLookup.size` read on the missing-endpoint bail (the
absent-key non-subscription in derives is a separate, known sharp edge).

## Why this matters upstream

The failure is silent and permanent, triggered by an idiomatic composition
(projections reading projections, rows created lazily in mapArray), and only
appears in real browsers — the worst possible detection profile. Even if the
exact trigger is subtle, a dev-mode warning when a computed finishes its
first run with zero dependencies while sources were read would have surfaced
this instantly.
