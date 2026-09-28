---
"@dschz/solid-flow": minor
---

Measurements are now sidecar-authoritative (second slice of the solid#3085 composition, after selection): rendering and `nodesInitialized` read the flow-owned measurements root joined with your rows, so both work correctly over `createOptimisticStore` inputs where the row write-through reverts. Precedence change: a fresh DOM measurement now supersedes a user-seeded `measured` value (previously the user seed always won); user-seeded `measured` still governs the pre-measurement window (SSR sizing, persisted layouts), and the write-through onto your rows remains for plain stores.
