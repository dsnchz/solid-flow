---
"@dschz/solid-flow": patch
---

`EdgeReconnectAnchor` no longer logs a `STRICT_READ_UNTRACKED` dev warning on mount. Used outside an edge component it still throws, through `useEdgeId`.
