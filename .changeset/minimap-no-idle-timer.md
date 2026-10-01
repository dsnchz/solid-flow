---
"@dschz/solid-flow": patch
---

`MiniMap` no longer keeps a timer running while the flow is idle. It polled for geometry changes every 250 ms for as long as it was mounted; it now re-samples the graph's bounds when node geometry changes, still at most every 250 ms outside a drag.
