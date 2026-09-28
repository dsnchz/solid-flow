---
"@dschz/solid-flow": patch
---

Node wrappers attach `pointerenter`/`pointerleave` listeners only when `onNodePointerEnter`/`onNodePointerLeave` are passed, and focus autopan listens through delegated `focusin` (5 listeners per node at 10k, from 8). A one-off `getIntersectingNodes` query walks the geometry map directly (0.35 ms at 10k, from 1.4); repeated queries in the same task still share the spatial grid.
