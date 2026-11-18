---
"@dschz/solid-flow": patch
---

Every node row the flow adopts (from `defaultNodes`, `createNodeStore` / `createOptimisticNodeStore` and `addNodes`) carries `measured`, `selected: false` and `dragging: false` from the start. `measured` is an empty object until the DOM has measured the node (`node.measured.width` is `undefined` before the first measurement), and the measuring pass writes `width` and `height` into that object instead of replacing it. A value you supply is kept, nothing is required on input, and a raw store you built yourself gets each key the first time the flow writes it. Internal nodes always carry an explicit `selected` boolean.
