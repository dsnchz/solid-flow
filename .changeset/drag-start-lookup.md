---
"@dschz/solid-flow": patch
---

Faster drag start: XYDrag's gesture start scanned every node through the reactive lookup to find the selected ones and the dragged node. The drag controller now receives a gesture-scoped view that iterates only those candidates (selected ids plus the dragged id) while still resolving any node by id. First drag frame at 10k nodes: 19 ms → 2 ms; selection-box drag worst frame 16 ms → 1 ms.
