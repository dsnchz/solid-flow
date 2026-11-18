---
"@dschz/solid-flow": patch
---

Built on `@xyflow/system` 1.0.0, the gesture engine of React Flow 13 and Svelte Flow 2 (0.2.x was on 0.0.80). Its breaking changes have their own entries; it brings these fixes: rapid pinch-zooms no longer corrupt the viewport (xyflow#5949); `fitView` handles hidden nodes that were never measured (xyflow#5841); panning with a multi-selection rectangle works (xyflow#5878); `NodeResizer` always fires `onResizeEnd` after `onResizeStart`, and its resize values are correct when `shouldResize` returns false; middle-mouse panning on nodes, edges and selections follows `panOnDrag`; resizing a node with a fixed `extent` and a non-default `origin` stays inside the extent; step and smooth-step edges keep their `borderRadius` at bends next to a straight run; the pan/zoom controller disconnects its pane `ResizeObserver` when the flow unmounts.
