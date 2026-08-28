---
"@dschz/solid-flow": minor
---

Selection is now sidecar-backed — the composition recommended by the SolidJS team in solidjs/solid#3085. Flow-driven selection lives in a library-owned keyed overlay joined with your rows at read time, with best-effort write-through onto your rows preserving the existing contract (reading `selected` off your store stays live for plain stores, and user writes to `selected` through your own store still govern). The payoff: selection now works and persists over `createOptimisticStore` inputs — clicks select, deselects route correctly, and selection survives `refresh()` reconciles — the first slice of full optimistic-store support. Internal nodes now always carry an explicit `selected` boolean (previously absent when the user row had none).
