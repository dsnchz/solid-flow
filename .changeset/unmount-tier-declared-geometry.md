---
"@dschz/solid-flow": patch
---

With `onlyRenderVisibleElements`, a node whose size (`measured`) and `handles` are declared is no longer mounted while it is off screen: it has nothing to measure, and its edges anchor on the declared handles until it mounts. Before, every node mounted once at the start and was unmounted afterwards. The flow also reads its container's size when it first renders its nodes, instead of waiting for the ResizeObserver's first callback, so culling is in effect from the first row.
