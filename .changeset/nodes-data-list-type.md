---
"@dschz/solid-flow": patch
---

Types: `useNodesData` called with a list of ids takes `Accessor<string[]>` and always returns an array (empty when no id names a node). It also accepted an accessor that could return `undefined` or `null`, typed the result as an array, and returned `undefined` in that case, so `.map()` on it could throw. For a list that may be missing, pass `() => ids() ?? []`. The single-id form is unchanged: it accepts a missing id and returns `undefined` until the id names a node.
