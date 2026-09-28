---
"@dschz/solid-flow": patch
---

Performance sweep (benchmarked before/after at 2.5k and 10k nodes):

- **MiniMap is now usable on large graphs.** Its viewBox/mask math re-ran ~30 unmemoized full-graph bounds scans per drag/pan frame — 1.5 seconds per mouse move at 2,500 nodes, and a hard freeze at 10,000. One memo chain later it's 20ms/move at 2.5k (74x) and 76ms at 10k (from frozen). Also fixed: pre-measurement graphs produced an Infinity bounds rect that could poison the shared viewport with NaN through the minimap's pan controller.
- Box selection membership is a Set instead of per-node `ids.includes` (was O(nodes x selection)).
- `store.nodeTypes` / `edgeTypes` / `connection` / `selectedNodes` / `selectedEdges` no longer allocate on every read (memoized); `actions.setViewport` has a stable identity; the selection box computes its bounds once per change instead of 7x per render; edge pointer handlers are wired directly.
