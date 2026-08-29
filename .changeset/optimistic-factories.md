---
"@dschz/solid-flow": minor
---

Typed optimistic store factories: `createOptimisticNodeStore` / `createOptimisticEdgeStore` — guided-union twins of the plain factories for the per-mutation sync pattern (`data` narrowed by `type`, `refresh()`-compatible return type). Purely a typing convenience: a raw `createOptimisticStore` composes with the flow identically.
