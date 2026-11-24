---
"@dschz/solid-flow": patch
---

`getIntersectingNodes` and `isNodeIntersecting` count full containment either way round, as React Flow and Svelte Flow do: with `partially` set to `false`, a node lying wholly inside the rect counts (before, only a node covering the whole rect did, so the call usually returned nothing). A node or rect without a size (a hidden or not yet measured node) never counts as intersecting; before, it matched everything it was compared with (xyflow#6164).
