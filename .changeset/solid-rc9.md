---
"@dschz/solid-flow": patch
---

solid-js 2.0.0-rc.9 (with `@solidjs/web`, `@solidjs/signals`, `@solidjs/compiler` and `@solidjs/diagnostics` in lockstep; `@solidjs/vite-plugin` 3.0.0-next.44). Mount and drag are flat on the 10k stress graph. Two engine regressions were isolated with headless repros and filed upstream (solidjs/solid#3664, #3665): enumerating a store object (the row projection's node spread) now allocates a presence node per key, which costs about 57 MB more JS heap after a 10k mount and 69 MB more retained after unmount than rc.8; and inside an open action an optimistic store's second setter can see a hole where the first setter pushed a row, so the row index scan now treats a hole as a miss instead of crashing. The playground's attribution probe moves to rc.9's named `costs()` export.
