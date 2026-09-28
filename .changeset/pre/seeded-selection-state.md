---
"@dschz/solid-flow": patch
---

Every node row the flow adopts now carries `selected: false` and `dragging: false` from the start, the way it already carries `measured`: rows from `defaultNodes`, `createNodeStore`, `createOptimisticNodeStore` and `addNodes` read back with both keys present, so a fresh row is explicitly unselected rather than missing the key. A value you supply is kept, and a raw store you built yourself is left alone until the flow first writes the key. Nothing is required on input. This is a shape decision, not a performance change.
