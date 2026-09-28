---
"@dschz/solid-flow": patch
---

Per-row sub-store architecture for the internal node and edge projections:
each row is its own keyed projection and the public records are shallow
projections of the row proxies. Dragging one node now costs O(changed) work —
0.51ms per move at 625 nodes and 1.37ms at 1600 (from 19.4ms), at parity with
the 0.2.x line at every scale measured, with identical fine-grained DOM
output.
