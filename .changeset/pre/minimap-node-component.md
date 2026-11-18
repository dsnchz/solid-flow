---
"@dschz/solid-flow": minor
---

`MiniMap` closes its React Flow parity gaps and stays usable on large graphs:

- Custom `nodeComponent`: render your own SVG representation per node, receiving the exported `MiniMapNodeProps` (id, flow-space geometry, colors, selection, and the node's own style, whose background also feeds the default rect's fill, matching upstream). The default `MiniMapNode` is exported for composition.
- `onClick` (a pane click, receiving the position in flow coordinates) and `onNodeClick` (receiving the clicked user node). Custom `nodeComponent`s receive the wired `onClick` through `MiniMapNodeProps`.
- `offsetScale` scales the padding around the graph (default `5`).
- The `nodeColor`, `nodeStrokeColor` and `nodeClass` callbacks receive the user node, matching upstream (they received the internal node).
- Performance: the viewBox and mask math no longer re-run unmemoized full-graph bounds scans on every drag or pan frame, so the MiniMap stays interactive on large graphs. Graph bounds are sampled incrementally: during a drag only the moving nodes are re-read, and a still graph is never rescanned.
- A graph whose nodes are not measured yet no longer produces an infinite bounds rect that could poison the viewport with `NaN` through the minimap's pan controller.
