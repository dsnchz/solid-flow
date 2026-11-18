---
"@dschz/solid-flow": patch
---

Breaking (types): the `HandleConnection` type export is removed; use `NodeConnection`, which has the same shape (`@xyflow/system` 1.0 aligns the connection APIs on it). The connection index, `useNodeConnections` and the `Handle` `onConnect` / `onDisconnect` callbacks already report `NodeConnection`s.
