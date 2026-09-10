---
"@dschz/solid-flow": patch
---

Faster edge reconnects: the connections index no longer rebuilds a fresh record (and has the engine reconcile and clone all of it) on every edge change. Its derive now applies only the changed edges' entries to the draft and never deletes root keys on a reconnect — a handle whose last connection is removed keeps an empty sub-record until the next never-seen handle key is added, which prunes it. `updateEdge(targetHandle)` at 10k nodes + 10k edges: 34 → 21 ms mean.
