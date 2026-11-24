---
"@dschz/solid-flow": patch
---

`NodeResizer` / `NodeResizeControl`: changing `onResizeStart`, `onResize`, `onResizeEnd` or `shouldResize` no longer re-arms the resize gesture. The new handler is called from the next event on, and a touch resize in progress is not cut short (before, a new handler rebound the drag listeners, which ended a touch resize without `onResizeEnd`, and a mouse resize in progress kept calling the old handler) (xyflow#6127).
