---
"@dschz/solid-flow": minor
---

New store sources for `createNodeStore` / `createEdgeStore`, and support for SolidJS 2.0 optimistic stores:

- Async seeds: pass `async () => data` (SolidJS 2.0 "Fetch High"). Reads are not ready until the data lands, and `SolidFlow` surfaces that first-load pending state to the nearest `<Loading fallback>` boundary (provider-adopted flows included) instead of silently rendering an empty graph. Once seeded, the stores are ordinary writable stores. See "Loading your graph from an API" in the README.
- Live flows: pass an async generator, a value that keeps arriving. The store is unsettled until the first yield, then every yield streams into the graph with fine-grained updates: membership changes, node moves and removals all flow through. Paired with a server function that yields, this is a server-pushed, collaborative flow in a handful of lines; see "Live flows" in the README.
- Optimistic stores: a `createOptimisticStore` passed as `nodes` / `edges` composes with the flow end to end (the "Write Sync, Run Async" pattern). Selection, measurements and drag positions live in flow-owned overlays joined with your rows at read time, so clicks select, drags move, and both survive `refresh()` reconciles; membership is rendered from your store, so an optimistic add appears immediately mid-action, a rejected action reverts the flow cleanly, and flow commands work inside open action transactions. On plain stores the flow still writes `selected`, `measured` and dragged positions through onto your rows, and your own writes to them govern. `createOptimisticNodeStore` / `createOptimisticEdgeStore` are typed twins of the plain factories (an inline array, an async function or an async generator, `data` narrowed by `type`, the derived forms keeping the `Refreshable` brand so `refresh()` typechecks). See "Per-mutation sync (optimistic stores)" in the README.

Behavior change: a fresh DOM measurement now supersedes a `measured` value seeded on the node (in 0.2.x the seeded value always won). A seeded `measured` still governs until the DOM measures the node (server rendering, persisted layouts).
