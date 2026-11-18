---
"@dschz/solid-flow": patch
---

`setViewport`, `setCenter` and `fitBounds` resolve `false` when a user interaction or another viewport change interrupts their animation, and `true` when it finishes (they always resolved `true`); `fitView`, `zoomIn`, `zoomOut` and `setZoom` do the same through `@xyflow/system` 1.0, where an interrupted animated `fitView()` used to leave its promise pending. Breaking: `fitBounds` pads by `"5%"` by default (was `0.1`), and a numeric `padding` in `fitViewOptions` / `fitBounds` options is in pixels; pass a percentage string for a relative padding (`0.1` was about `"4.5%"`, `2` about `"33%"`).
