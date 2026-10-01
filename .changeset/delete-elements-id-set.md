---
"@dschz/solid-flow": patch
---

`deleteElements` (and the Delete key) no longer scan the deleted list once per remaining node and edge: at 10k nodes, deleting 1,000 took 2.4 s and 5,000 took 9.4 s; both now take about 0.2 s.
