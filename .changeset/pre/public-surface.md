---
"@dschz/solid-flow": minor
---

The package no longer exports its internal components. The public components now match React Flow's and Svelte Flow's: `SolidFlow`, `SolidFlowProvider`, `Handle`, the built-in edges (`BaseEdge`, `BezierEdge`, `SmoothStepEdge`, `StepEdge`, `StraightEdge`), `EdgeLabel`, `EdgeLabelRenderer`, `EdgeReconnectAnchor`, `Panel`, `ViewportPortal` and the plugins. Removed: `NodeWrapper`, `EdgeWrapper`, `NodeRenderer`, `EdgeRenderer`, `Pane`, `Zoom`, `Viewport` (the component; the `Viewport` type is unchanged), `NodeSelection`, `Selection`, `ConnectionLine`, `Marker`, `MarkerDefinition`, the built-in node components (`DefaultNode`, `InputNode`, `OutputNode`, `GroupNode`) and the `*EdgeInternal` edges. These were renderer internals with no supported use, and exporting them would have made every change to them a breaking change after 1.0.
