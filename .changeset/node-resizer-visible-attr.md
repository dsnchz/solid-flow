---
"@dschz/solid-flow": patch
---

`NodeResizer` no longer puts its `visible` prop on every resize control as a DOM attribute; like Svelte Flow, it keeps its own props off the controls.
