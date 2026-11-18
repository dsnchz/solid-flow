---
"@dschz/solid-flow": patch
---

`NodeResizer` fixes:

- Resizing a node from its top or left edge moves it when the new position has a 0 coordinate. A node on the `y: 0` line (or landing on `x: 0`) used to keep its old position while its size changed, so it grew in the wrong direction.
- Resizing a parent node from its top or left edge no longer clears the `width` and `height` of its child nodes. The resizer repositions the children to keep them in place, and that position-only change used to write `undefined` over their size, so explicitly sized children collapsed to their content size.
- `NodeResizer` no longer puts its `visible` prop on every resize control as a DOM attribute; like Svelte Flow, it keeps its own props off the controls.
- `NodeResizerProps` types `color`, as React Flow and Svelte Flow do. It already reached the controls at runtime; TypeScript rejected it.
