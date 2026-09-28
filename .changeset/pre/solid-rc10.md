---
"@dschz/solid-flow": patch
---

solid-js 2.0.0-rc.10 (with `@solidjs/web`, `@solidjs/signals`, `@solidjs/compiler` and `@solidjs/diagnostics` in lockstep; `@solidjs/vite-plugin` 3.0.0-next.46). Both engine regressions filed from this library against rc.9 are fixed: enumerating a store object no longer allocates a presence node per key (solidjs/solid#3664), and an optimistic store's second setter inside an open action no longer sees a hole where the first pushed a row (solidjs/solid#3665), so flow commands work inside an action again. On the 10k stress graph the JS heap after mount drops from 656 to 632 MB and the heap retained after deleting or unmounting the graph drops by about 4 MB; whole-graph replacement is 4 to 9 percent faster; every interaction is unchanged.
