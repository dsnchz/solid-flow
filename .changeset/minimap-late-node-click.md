---
"@dschz/solid-flow": patch
---

A `MiniMap` `onNodeClick` set after mount now reaches the minimap nodes; the default `MiniMapNode` bound its click handler only if one was present when it was created.
