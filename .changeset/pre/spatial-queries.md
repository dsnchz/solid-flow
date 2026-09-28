---
"@dschz/solid-flow": patch
---

Spatial queries (benchmarked at 10k nodes): connection drags are now interactive on large graphs — per-move cost went from ~422ms (every pointermove ran upstream's full node scan PLUS a ~20k-handle reactive fan-out) to ~5ms median / 17ms p95, a 31x mean improvement. Three pieces: a gesture-scoped spatial grid feeds XYHandle's closest-handle search from the pointer's neighborhood (node geometry is frozen during gestures, so the snapshot is exact); handles subscribe to equality-cut connection state instead of the per-move connection object; and the hover-target is a keyed record, so snapping onto a handle touches two handles instead of all of them. Box selection narrows its per-move sweep through the same grid, and `getIntersectingNodes` shares one grid build across same-task calls (the per-dragged-node collision pattern drops from N full scans to one build + N neighborhood queries; it remains a snapshot/pull API).
