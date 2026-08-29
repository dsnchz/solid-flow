---
"@dschz/solid-flow": minor
---

Typed optimistic store factories: `createOptimisticNodeStore` / `createOptimisticEdgeStore` — guided-union twins of the plain factories for the per-mutation sync pattern, mirroring the full core surface: an inline array, an async function, or an async generator (`data` narrowed by `type`; the derived forms keep the `Refreshable` brand so `refresh()` typechecks). Purely a typing convenience: a raw `createOptimisticStore` composes with the flow identically.
