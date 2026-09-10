---
"@dschz/solid-flow": patch
---

`getIntersectingNodes` / `isNodeIntersecting` build their per-task spatial grid from the flow's plain geometry map instead of reading every node through the reactive rows. First call in a task at 10k nodes: 32 ms → 1.2 ms, identical results.
