---
"@dschz/solid-flow": patch
---

Breaking: `nodeClickDistance` is removed, as in React Flow 13 and Svelte Flow 2. Whether a click on a node fires now depends only on whether a drag moved nodes: the click after a drag that moved them (or after a release outside the node) is swallowed, and any other click fires, including one after a jitter shorter than `nodeDragThreshold` (before, any pointer movement past `nodeClickDistance`, `0` by default, swallowed it). Use `nodeDragThreshold` (and `snapGrid`) to tune it.
