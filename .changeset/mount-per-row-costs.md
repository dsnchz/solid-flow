---
"@dschz/solid-flow": patch
---

Faster mount: each node and edge wrapper now resolves its row once (a memo) instead of ~50 times per render through the record, renders its user component through `dynamic()` directly instead of `<Dynamic>` (which re-copied every prop per row), and assigns element classes as one string instead of the array/object form that flattens and diffs a key map on every assignment. Mount at 10k nodes + 10k edges: 3.25 s → 2.6 s in a production build; selection drag 0.6 → 0.35 ms per move.
