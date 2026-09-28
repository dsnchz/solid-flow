---
"@dschz/solid-flow": minor
---

`MiniMap` supports a custom `nodeComponent` (React Flow parity): render your
own SVG representation per node, receiving the exported `MiniMapNodeProps`
(id, flow-space geometry, colors, selection, and the node's own style —
whose background also now feeds the default rect's fill, matching upstream).
The default `MiniMapNode` is exported for composition.
