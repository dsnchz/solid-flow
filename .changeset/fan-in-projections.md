---
"@dschz/solid-flow": patch
---

Remaining fan-in derivations become keyed/per-row (guided by SolidJS rc.7's `HUGE_FAN_IN` diagnostics): `nodesInitialized` reads a keyed unmeasured-node record instead of four leaves of every node, the measurements garbage collector reads the shared id list, the connections index and the edge-marker definitions derive per edge and merge by key. A measurement write, a reconnect or a marker change now re-derives one row instead of the whole graph. Core reactive nodes are named so dev diagnostics and `DEV.attribution.costs()` identify them; the stress example enables attribution with `?attr=1`.
