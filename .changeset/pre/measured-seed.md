---
"@dschz/solid-flow": patch
---

Every node row the flow adopts carries `measured` from the start (an empty object until the DOM has measured it; `node.measured.width` is `undefined` before the first measurement): rows from `defaultNodes`, `createNodeStore` / `createOptimisticNodeStore` and `addNodes` are seeded while still plain, and the measuring pass writes `width` and `height` as leaves into that object instead of replacing it, so a re-measure no longer rebuilds the row (an identical pass 224 -> 22 ms at 10k; mount 2.3 -> 2.2 s). A row from a raw store you built yourself gets the key on its first measurement, as before.
