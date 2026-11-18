---
"@dschz/solid-flow": patch
---

Built on `@xyflow/system` 1.0.0, the gesture engine of React Flow 13 and Svelte Flow 2 (was 0.0.84). It brings these fixes: middle-mouse panning on nodes, edges and selections follows `panOnDrag`; resizing a node with a fixed `extent` and a non-default `origin` stays inside the extent; step and smooth-step edges keep their `borderRadius` at bends next to a straight run; the pan/zoom controller disconnects its pane `ResizeObserver` when the flow unmounts. Losing window focus mid-gesture (Alt+Tab with the button held) now also ends an in-progress connection, as it already ended node drags and pans.
