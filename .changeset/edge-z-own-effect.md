---
"@dschz/solid-flow": patch
---

Selecting or deselecting nodes redraws only their edges' z-index: an edge's class and aria attributes are no longer recomputed with it. At 10k nodes a select-all or deselect-all takes about 10% less time, for about 5 MB more heap on mount. The edge's DOM is unchanged; in server-rendered markup its `<g>` now carries its own hydration key.
