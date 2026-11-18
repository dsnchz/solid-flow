---
"@dschz/solid-flow": minor
---

Breaking: the package no longer exports its internal components. The public components match React Flow's and Svelte Flow's: `SolidFlow`, `SolidFlowProvider`, `Handle`, the built-in edges (`BaseEdge`, `BezierEdge`, `SmoothStepEdge`, `StepEdge`, `StraightEdge`), `EdgeLabel`, `EdgeLabelRenderer`, `EdgeReconnectAnchor`, `Panel`, `ViewportPortal` and the plugins. Removed: `NodeWrapper`, `EdgeWrapper`, `NodeRenderer`, `EdgeRenderer`, `Pane`, `Zoom`, `Viewport` (the component; the `Viewport` type is unchanged), `NodeSelection`, `Selection`, `ConnectionLine`, `Marker`, `MarkerDefinition`, the built-in node components (`DefaultNode`, `InputNode`, `OutputNode`, `GroupNode`) and the `*EdgeInternal` edges. These were renderer internals with no supported use.

Breaking: `ResizeControl` is renamed `NodeResizeControl`, the name React Flow and Svelte Flow export (and keep in their next majors). Update imports: `import { NodeResizeControl } from "@dschz/solid-flow"`. Props are unchanged.
