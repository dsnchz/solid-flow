---
"@dschz/solid-flow": patch
---

An edge between nodes that declare their own `handles` (server rendering, or before the DOM measures the handles) is laid out when a handle has no `width`/`height`: such a handle is 1x1, as in React Flow and Svelte Flow. The edge's coordinates were `NaN`, because `@xyflow/system` sizes the declared handles by writing into them and the flow's node rows ignored the write.
