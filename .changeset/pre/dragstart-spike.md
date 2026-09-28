---
"@dschz/solid-flow": patch
---

Drag-start cost at 10k nodes cut ~6.5x (first gesture frame 1605ms → ~250ms; drag mean 16.5 → 6.3 ms/move), root-caused by CPU profiling: `unselectNodesAndEdges` deselected every element unconditionally (now O(actually-selected) via the joined views), the selection views were whole-graph filter memos rebuilding two subscriptions per element per recompute (now keyed presence projections with O(changed) updates), and the internal record facade's `in`-first probe subscribed every keyed consumer record-wide (now a present-key fast path). The spike predates the sidecar work — it was invisible in mean-only benchmarks.
