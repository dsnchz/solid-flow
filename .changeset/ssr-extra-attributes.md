---
"@dschz/solid-flow": patch
---

`Handle` and `BaseEdge` render their extra attributes (any prop they do not consume, such as `data-*` or `aria-*`) in server-rendered markup, as React Flow and Svelte Flow do; before, they appeared only after hydration.
