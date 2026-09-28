---
"@dschz/solid-flow": patch
---

Bump `@xyflow/system` to 0.0.81, inheriting upstream fixes for rapid-pinch viewport corruption (xyflow#5949), fitView with never-measured hidden nodes (xyflow#5841), and multi-select-rectangle panning (xyflow#5878). The `ProOptions` type (removed from system's exports) is now defined and exported by Solid Flow directly — no API change for consumers importing it from `@dschz/solid-flow`.
