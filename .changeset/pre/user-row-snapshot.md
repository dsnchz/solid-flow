---
"@dschz/solid-flow": patch
---

Node row projections read the user row through a per-node snapshot memo, so a measurement, selection or drag-overlay change re-derives the geometry without re-enumerating the user node (10k mount 3.1 s -> 2.9 s, heap 832 -> 819 MB; a full re-measure pass costs 40% less).
