---
"@dschz/solid-flow": patch
---

solid-js 2.0.0-rc.8 (with `@solidjs/web`, `@solidjs/signals`, `@solidjs/compiler` and `@solidjs/diagnostics` in lockstep). rc.8 carries the three engine fixes filed from this library (solidjs/solid#3350, #3351, #3352), and on the 10k stress graph an edge reconnect drops from ~22 ms to ~11 ms while memory retained after deleting every element drops from 51 MB to 35 MB and after unmounting the flow from 333 MB to 284 MB, with no library change. The connections index now deletes emptied handle keys directly instead of pruning them lazily (the root-write clone that motivated lazy pruning is gone). The playground's attribution probe moves to rc.8's `solid-js/attribution` entry.
