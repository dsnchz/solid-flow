---
"@dschz/solid-flow": patch
---

`NodeResizer` no longer logs a `STRICT_READ_UNTRACKED` dev warning per control on mount: each control reads its node id once when it creates its resizer, as Svelte Flow does.
